const db = require('../db');

/**
 * List users (admin)
 */
function list(req, res) {
    db.query('SELECT id, username, email, role FROM users ORDER BY id DESC', (err, results) => {
        if (err) {
            req.flash('error', 'Failed to load users');
            return res.redirect('/');
        }
        return res.render('users', { users: results || [] });
    });
}

/**
 * Render add user form (admin)
 */
function renderAdd(req, res) {
    return res.render('addUser');
}

/**
 * Add user - used both by public registration and admin create.
 * Enforce: public registration can only create users with role = 'user'.
 * Admins can set role via the admin form.
 */
function add(req, res, next) {
    const username = (req.body.username || '').trim();
    const email = (req.body.email || '').trim();
    const password = (req.body.password || '').trim();

    if (!username || !email || !password) {
        req.flash('error', 'All fields are required.');
        // If admin creating user, redirect back to admin form, else to register
        if (req.session && req.session.user && req.session.user.role === 'admin') {
            return res.redirect('/users/add');
        }
        return res.redirect('/register');
    }

    // Determine role: if current session is admin and coming from admin create, allow provided role.
    let role = 'user';
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        const r = (req.body.role || '').trim();
        role = (r === 'admin') ? 'admin' : 'user';
    } else {
        // Public registration must be 'user'
        role = 'user';
    }

    // check duplicate email
    db.query('SELECT id FROM users WHERE email = ?', [email], (err, rows) => {
        if (err) {
            req.flash('error', 'Database error');
            return res.redirect(req.session && req.session.user && req.session.user.role === 'admin' ? '/users/add' : '/register');
        }
        if (rows && rows.length > 0) {
            req.flash('error', 'Email already registered.');
            return res.redirect(req.session && req.session.user && req.session.user.role === 'admin' ? '/users/add' : '/register');
        }

        // insert user (password hashed with SHA1 to match login)
        const sql = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, SHA1(?), ?)';
        db.query(sql, [username, email, password, role], (insErr, result) => {
            if (insErr) {
                req.flash('error', 'Failed to create user.');
                return res.redirect(req.session && req.session.user && req.session.user.role === 'admin' ? '/users/add' : '/register');
            }

            // If admin created user, stay in admin area; else redirect to login
            if (req.session && req.session.user && req.session.user.role === 'admin') {
                req.flash('success', 'User created successfully.');
                return res.redirect('/users');
            }
            req.flash('success', 'Registration successful. Please log in.');
            return res.redirect('/login');
        });
    });
}

/**
 * Get user by id (admin)
 */
function getById(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!id) {
        req.flash('error', 'Invalid user id');
        return res.redirect('/users');
    }
    db.query('SELECT id, username, email, role FROM users WHERE id = ?', [id], (err, rows) => {
        if (err || !rows || rows.length === 0) {
            req.flash('error', 'User not found');
            return res.redirect('/users');
        }
        return res.render('editUser', { userData: rows[0] });
    });
}

/**
 * Update user (admin)
 */
function update(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!id) {
        req.flash('error', 'Invalid user id');
        return res.redirect('/users');
    }
    const username = (req.body.username || '').trim();
    const email = (req.body.email || '').trim();
    const role = (req.body.role === 'admin') ? 'admin' : 'user';

    if (!username || !email) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/users/' + id);
    }

    const sql = 'UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?';
    db.query(sql, [username, email, role, id], (err) => {
        if (err) req.flash('error', 'Failed to update user');
        else req.flash('success', 'User updated');
        return res.redirect('/users');
    });
}

/**
 * Delete user (admin)
 */
function remove(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!id) {
        req.flash('error', 'Invalid user id');
        return res.redirect('/users');
    }
    db.query('DELETE FROM users WHERE id = ?', [id], (err) => {
        if (err) req.flash('error', 'Failed to delete user');
        else req.flash('success', 'User deleted');
        return res.redirect('/users');
    });
}

module.exports = {
    list,
    renderAdd,
    add,
    getById,
    update,
    delete: remove
};