const db = require('../db');

function getAll(callback) {
    const sql = 'SELECT id, username, email, address, contact, role FROM users';
    db.query(sql, function (err, results) {
        if (err) return callback(err);
        callback(null, results);
    });
}

function getById(id, callback) {
    const sql = 'SELECT id, username, email, address, contact, role FROM users WHERE id = ?';
    db.query(sql, [id], function (err, results) {
        if (err) return callback(err);
        callback(null, results[0] || null);
    });
}

function add(user, callback) {
    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, ?, ?, ?, ?)';
    const params = [
        user.username,
        user.email,
        user.password, // assume caller hashes password when needed
        user.address || null,
        user.contact || null,
        user.role || 'user'
    ];
    db.query(sql, params, function (err, results) {
        if (err) return callback(err);
        callback(null, { id: results.insertId, ...user });
    });
}

function update(id, user, callback) {
    // If password present, update it; otherwise keep current password by not changing that column.
    if (typeof user.password !== 'undefined' && user.password !== null) {
        const sql = 'UPDATE users SET username = ?, email = ?, password = ?, address = ?, contact = ?, role = ? WHERE id = ?';
        const params = [
            user.username,
            user.email,
            user.password,
            user.address || null,
            user.contact || null,
            user.role || 'user',
            id
        ];
        db.query(sql, params, function (err, results) {
            if (err) return callback(err);
            callback(null, { affectedRows: results.affectedRows, changedRows: results.changedRows });
        });
    } else {
        const sql = 'UPDATE users SET username = ?, email = ?, address = ?, contact = ?, role = ? WHERE id = ?';
        const params = [
            user.username,
            user.email,
            user.address || null,
            user.contact || null,
            user.role || 'user',
            id
        ];
        db.query(sql, params, function (err, results) {
            if (err) return callback(err);
            callback(null, { affectedRows: results.affectedRows, changedRows: results.changedRows });
        });
    }
}

function remove(id, callback) {
    const sql = 'DELETE FROM users WHERE id = ?';
    db.query(sql, [id], function (err, results) {
        if (err) return callback(err);
        callback(null, { affectedRows: results.affectedRows });
    });
}

module.exports = {
    getAll,
    getById,
    add,
    update,
    delete: remove
};