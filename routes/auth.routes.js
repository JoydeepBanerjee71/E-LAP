const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db.config');

router.post('/register', async (req, res) => {
    // Get connection from pool for transaction handling
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { 
            username, 
            email, 
            password, 
            full_name, 
            phone_number,
            address,
            role, 
            company_name, 
            min_cibil, 
            max_loan_amount, 
            interest_rate_offered, 
            supported_loan_types 
        } = req.body;
        
        const userRole = role || 'borrower';

        // Check if user already exists
        const [existingUsers] = await conn.query(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const [result] = await conn.query(
            'INSERT INTO users (username, email, password, full_name, phone_number, address, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, full_name, phone_number || null, address || null, userRole]
        );

        const userId = result.insertId;

        // If registered as lender, add lender details profile
        if (userRole === 'lender') {
            if (!company_name || min_cibil === undefined || !max_loan_amount || !interest_rate_offered || !supported_loan_types) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({ error: 'Missing lender profile registration metrics' });
            }

            await conn.query(
                'INSERT INTO lender_details (user_id, company_name, min_cibil, max_loan_amount, interest_rate_offered, supported_loan_types) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    userId,
                    company_name,
                    parseInt(min_cibil),
                    parseFloat(max_loan_amount),
                    parseFloat(interest_rate_offered),
                    Array.isArray(supported_loan_types) ? supported_loan_types.join(',') : supported_loan_types
                ]
            );
        }

        await conn.commit();
        conn.release();

        const token = jwt.sign({ userId: userId, role: userRole }, process.env.JWT_SECRET);
        res.status(201).json({ token, role: userRole });
    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find user by username OR email
        const [users] = await db.query(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET);
        res.json({ token, role: user.role, username: user.username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 