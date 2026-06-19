const express = require('express');
const router = express.Router();
const db = require('../config/db.config');

// GET /api/loan/match-lenders
// Find lenders that match borrower CIBIL score, loan amount, and type
router.get('/match-lenders', async (req, res) => {
    try {
        const { cibil, amount, loan_type } = req.query;

        if (!cibil || !amount || !loan_type) {
            return res.status(400).json({ error: 'Missing matching criteria (cibil, amount, loan_type)' });
        }

        // Query database for lenders whose requirements are satisfied by user's CIBIL, maximum funding amount, and support the loan type.
        // We order by lowest interest rate first to give the borrower the best deal!
        const queryStr = `
            SELECT ld.*, u.full_name as company_name, u.email as lender_email
            FROM lender_details ld
            JOIN users u ON ld.user_id = u.id
            WHERE ld.min_cibil <= ? 
              AND ld.max_loan_amount >= ?
              AND FIND_IN_SET(?, ld.supported_loan_types) > 0
            ORDER BY ld.interest_rate_offered ASC
        `;
        
        const [lenders] = await db.query(queryStr, [
            parseInt(cibil), 
            parseFloat(amount), 
            loan_type
        ]);

        res.json(lenders);
    } catch (error) {
        console.error('Lender matching error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/loan/apply
// Borrower submits a loan application to a specific lender
router.post('/apply', async (req, res) => {
    try {
        const { lender_id, loan_type, amount, tenure_months, interest_rate, cibil_score } = req.body;
        const userId = req.user.userId;

        if (!lender_id || !loan_type || !amount || !tenure_months || !interest_rate) {
            return res.status(400).json({ error: 'Missing loan application parameters' });
        }

        // Create a new loan application in the loans table (including CIBIL score if provided)
        const [result] = await db.query(
            'INSERT INTO loans (user_id, lender_id, loan_type, amount, interest_rate, tenure_months, cibil_score, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, parseInt(lender_id), loan_type, parseFloat(amount), parseFloat(interest_rate), parseInt(tenure_months), cibil_score ? parseInt(cibil_score) : null, 'pending']
        );

        res.status(201).json({
            message: 'Loan application submitted successfully to lender',
            loan_id: result.insertId
        });
    } catch (error) {
        console.error('Loan application submission error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/loan/lender-applications
// Get all loan applications submitted to the logged-in lender
router.get('/lender-applications', async (req, res) => {
    try {
        const lenderId = req.user.userId;
        const role = req.user.role;

        if (role !== 'lender') {
            return res.status(403).json({ error: 'Access denied: Only lenders can view lender applications' });
        }

        // Retrieve loans matching this lender, join users to see borrower details
        const queryStr = `
            SELECT l.*, u.full_name as borrower_name, u.email as borrower_email, u.phone_number as borrower_phone
            FROM loans l
            JOIN users u ON l.user_id = u.id
            WHERE l.lender_id = ?
            ORDER BY l.created_at DESC
        `;
        const [applications] = await db.query(queryStr, [lenderId]);

        res.json(applications);
    } catch (error) {
        console.error('Fetch lender applications error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/loan/update-status
// Lender updates loan application status (approved/rejected)
router.post('/update-status', async (req, res) => {
    try {
        const { loan_id, status } = req.body;
        const lenderId = req.user.userId;
        const role = req.user.role;

        if (role !== 'lender') {
            return res.status(403).json({ error: 'Access denied: Only lenders can update loan status' });
        }

        if (!loan_id || !status) {
            return res.status(400).json({ error: 'Missing loan_id or status parameters' });
        }

        if (status !== 'approved' && status !== 'rejected') {
            return res.status(400).json({ error: 'Invalid status value. Must be approved or rejected.' });
        }

        // Update application
        const [result] = await db.query(
            'UPDATE loans SET status = ? WHERE id = ? AND lender_id = ?',
            [status, parseInt(loan_id), lenderId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Loan application not found or unauthorized' });
        }

        res.json({ message: `Loan application status successfully set to ${status}` });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
