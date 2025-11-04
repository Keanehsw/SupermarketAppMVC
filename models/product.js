// ...existing code...
const db = require('../db');

function getAll(callback) {
    const sql = 'SELECT id, ProductName, quantity, price, image FROM products';
    db.query(sql, function (err, results) {
        if (err) return callback(err);
        callback(null, results);
    });
}

function getById(id, callback) {
    const sql = 'SELECT id, ProductName, quantity, price, image FROM products WHERE id = ?';
    db.query(sql, [id], function (err, results) {
        if (err) return callback(err);
        callback(null, results[0] || null);
    });
}

function add(product, callback) {
    const sql = 'INSERT INTO products (ProductName, quantity, price, image) VALUES (?, ?, ?, ?)';
    const params = [
        product.ProductName,
        product.quantity,
        product.price,
        product.image || null
    ];
    db.query(sql, params, function (err, results) {
        if (err) return callback(err);
        callback(null, { id: results.insertId, ...product });
    });
}

function update(id, product, callback) {
    const sql = 'UPDATE products SET ProductName = ?, quantity = ?, price = ?, image = ? WHERE id = ?';
    const params = [
        product.ProductName,
        product.quantity,
        product.price,
        product.image || null,
        id
    ];
    db.query(sql, params, function (err, results) {
        if (err) return callback(err);
        callback(null, { affectedRows: results.affectedRows, changedRows: results.changedRows });
    });
}

function remove(id, callback) {
    const sql = 'DELETE FROM products WHERE id = ?';
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
// ...existing code...