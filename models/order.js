// ...existing code...
const db = require('../db');

function create(userId, total, status, callback) {
    const sql = 'INSERT INTO orders (user_id, total, status, created_at) VALUES (?, ?, ?, NOW())';
    db.query(sql, [userId, total, status], (err, results) => {
        if (err) return callback(err);
        return callback(null, { id: results.insertId });
    });
}

function getById(id, callback) {
    const sql = 'SELECT * FROM orders WHERE id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) return callback(err);
        return callback(null, results[0] || null);
    });
}

function getAll(callback) {
    const sql = 'SELECT * FROM orders ORDER BY created_at DESC';
    db.query(sql, (err, results) => {
        if (err) return callback(err);
        return callback(null, results);
    });
}

function getByUserId(userId, callback) {
    const sql = 'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC';
    db.query(sql, [userId], (err, results) => {
        if (err) return callback(err);
        return callback(null, results);
    });
}

function updateStatus(id, status, callback) {
    const sql = 'UPDATE orders SET status = ? WHERE id = ?';
    db.query(sql, [status, id], (err, results) => {
        if (err) return callback(err);
        return callback(null, { affectedRows: results.affectedRows });
    });
}

function remove(id, callback) {
    const sql = 'DELETE FROM orders WHERE id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) return callback(err);
        return callback(null, { affectedRows: results.affectedRows });
    });
}

module.exports = {
    create,
    getById,
    getAll,
    getByUserId,
    updateStatus,
    delete: remove
};
// ...existing code...