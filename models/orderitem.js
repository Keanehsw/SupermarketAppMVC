// ...existing code...
const db = require('../db');

function addMany(orderId, items, callback) {
    if (!items || items.length === 0) return callback(null);
    const values = [];
    const placeholders = items.map(it => {
        values.push(orderId, it.productId, it.quantity, it.price);
        return '(?, ?, ?, ?)';
    }).join(', ');
    const sql = `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ${placeholders}`;
    db.query(sql, values, (err, results) => {
        if (err) return callback(err);
        return callback(null, results);
    });
}

function getByOrderId(orderId, callback) {
    const sql = 'SELECT oi.*, p.ProductName FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?';
    db.query(sql, [orderId], (err, results) => {
        if (err) return callback(err);
        return callback(null, results);
    });
}

function deleteByOrderId(orderId, callback) {
    const sql = 'DELETE FROM order_items WHERE order_id = ?';
    db.query(sql, [orderId], (err, results) => {
        if (err) return callback(err);
        return callback(null, { affectedRows: results.affectedRows });
    });
}

module.exports = {
    addMany,
    getByOrderId,
    deleteByOrderId
};
// ...existing code...