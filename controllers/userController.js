const userModel = require('../models/user');

function list(req, res) {
    userModel.getAll(function (err, users) {
        if (err) {
            req.flash('error', err.message || err);
            return res.status(500).redirect('/');
        }
        // render a users list view if you have one, otherwise return JSON
        if (req.accepts('html')) {
            return res.render('users', { users, user: req.session.user });
        }
        return res.json(users);
    });
}

function getById(req, res) {
    const id = parseInt(req.params.id, 10);
    userModel.getById(id, function (err, userData) {
        if (err) {
            req.flash('error', err.message || err);
            return res.status(500).redirect('/users');
        }
        if (!userData) {
            req.flash('error', 'User not found');
            return res.status(404).redirect('/users');
        }
        if (req.accepts('html')) {
            return res.render('editUser', { userData, user: req.session.user });
        }
        return res.json(userData);
    });
}

function add(req, res) {
    const newUser = {
        username: req.body.username,
        email: req.body.email,
        password: req.body.password, // caller/controller may hash before storing if desired
        address: req.body.address || null,
        contact: req.body.contact || null,
        role: req.body.role || 'user'
    };

    if (!newUser.username || !newUser.email || !newUser.password) {
        req.flash('error', 'username, email and password are required');
        return res.redirect('/register');
    }

    userModel.add(newUser, function (err, created) {
        if (err) {
            req.flash('error', err.message || err);
            return res.status(500).redirect('/register');
        }
        // redirect to users list (admin) or login flow
        return res.redirect('/login');
    });
}

function update(req, res) {
    const id = parseInt(req.params.id, 10);
    const updated = {
        username: req.body.username,
        email: req.body.email,
        // only set password if provided
        password: req.body.password ? req.body.password : undefined,
        address: req.body.address || null,
        contact: req.body.contact || null,
        role: req.body.role || 'user'
    };

    userModel.update(id, updated, function (err, result) {
        if (err) {
            req.flash('error', err.message || err);
            return res.status(500).redirect('/users');
        }
        if (!result || result.affectedRows === 0) {
            req.flash('error', 'User not found or no changes made');
            return res.status(404).redirect('/users');
        }
        return res.redirect('/users');
    });
}

function remove(req, res) {
    const id = parseInt(req.params.id, 10);
    userModel.delete(id, function (err, result) {
        if (err) {
            req.flash('error', err.message || err);
            return res.status(500).redirect('/users');
        }
        if (!result || result.affectedRows === 0) {
            req.flash('error', 'User not found');
            return res.status(404).redirect('/users');
        }
        return res.redirect('/users');
    });
}

module.exports = {
    list,
    getById,
    add,
    update,
    delete: remove
};