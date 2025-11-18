const userModel = require('../models/user');
const crypto = require('crypto');

function list(req, res) {
    userModel.getAll(function (err, users) {
        if (err) {
            req.flash('error', err.message || err);
            return res.status(500).redirect('/');
        }
        return res.render('users', { users, user: req.session.user, messages: req.flash() });
    });
}

function getById(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!id) {
        req.flash('error', 'Invalid user id');
        return res.redirect('/users');
    }
    userModel.getById(id, function (err, userData) {
        if (err) {
            req.flash('error', err.message || err);
            return res.status(500).redirect('/users');
        }
        if (!userData) {
            req.flash('error', 'User not found');
            return res.redirect('/users');
        }
        return res.render('editUser', { userData, user: req.session.user, messages: req.flash() });
    });
}

function renderAdd(req, res) {
    return res.render('addUser', { user: req.session.user, messages: req.flash() });
}

function add(req, res) {
    const newUser = {
        username: (req.body.username || '').trim(),
        email: (req.body.email || '').trim(),
        password: req.body.password,
        address: req.body.address || null,
        contact: req.body.contact || null,
        role: req.body.role || 'user'
    };

    if (!newUser.username || !newUser.email || !newUser.password) {
        req.flash('error', 'username, email and password are required');
        return res.redirect('/users/add');
    }

    newUser.password = crypto.createHash('sha1').update(newUser.password).digest('hex');

    userModel.add(newUser, function (err) {
        if (err) {
            req.flash('error', err.message || err);
            return res.redirect('/users/add');
        }
        req.flash('success', 'User created');
        return res.redirect('/users');
    });
}

function update(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!id) {
        req.flash('error', 'Invalid user id');
        return res.redirect('/users');
    }

    const updated = {
        username: (req.body.username || '').trim(),
        email: (req.body.email || '').trim(),
        password: req.body.password ? crypto.createHash('sha1').update(req.body.password).digest('hex') : undefined,
        address: req.body.address || null,
        contact: req.body.contact || null,
        role: req.body.role || 'user'
    };

    userModel.update(id, updated, function (err, result) {
        if (err) {
            req.flash('error', err.message || err);
            return res.redirect('/users');
        }
        if (!result || result.affectedRows === 0) {
            req.flash('error', 'User not found or no changes made');
            return res.redirect('/users');
        }
        req.flash('success', 'User updated');
        return res.redirect('/users');
    });
}

function remove(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!id) {
        req.flash('error', 'Invalid user id');
        return res.redirect('/users');
    }
    userModel.delete(id, function (err, result) {
        if (err) {
            req.flash('error', err.message || err);
            return res.redirect('/users');
        }
        if (!result || result.affectedRows === 0) {
            req.flash('error', 'User not found');
            return res.redirect('/users');
        }
        req.flash('success', 'User deleted');
        return res.redirect('/users');
    });
}

module.exports = {
    list,
    getById,
    renderAdd,
    add,
    update,
    delete: remove
};