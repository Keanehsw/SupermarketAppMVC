const db = require('../db');

/**
 * Get product by id
 */
function getById(id, callback) {
    const sql = 'SELECT id, ProductName, price, quantity, image FROM products WHERE id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) return callback(err);
        return callback(null, results[0] || null);
    });
}

/**
 * Get all products
 */
function getAll(callback) {
    const sql = 'SELECT id, ProductName, price, quantity, image FROM products ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) return callback(err);
        return callback(null, results || []);
    });
}

/**
 * Create a new product
 * productObj: { ProductName, price, quantity, image }
 */
function create(productObj, callback) {
    const sql = 'INSERT INTO products (ProductName, price, quantity, image) VALUES (?, ?, ?, ?)';
    const params = [
        productObj.ProductName || null,
        typeof productObj.price !== 'undefined' ? productObj.price : 0,
        typeof productObj.quantity !== 'undefined' ? productObj.quantity : 0,
        productObj.image || null
    ];
    db.query(sql, params, (err, results) => {
        if (err) return callback(err);
        return callback(null, { id: results.insertId });
    });
}

/**
 * Update a product
 * productObj: { ProductName, price, quantity, image }
 */
function update(id, productObj, callback) {
    const sql = 'UPDATE products SET ProductName = ?, price = ?, quantity = ?, image = ? WHERE id = ?';
    const params = [
        productObj.ProductName || null,
        typeof productObj.price !== 'undefined' ? productObj.price : 0,
        typeof productObj.quantity !== 'undefined' ? productObj.quantity : null,
        productObj.image || null,
        id
    ];
    db.query(sql, params, (err, results) => {
        if (err) return callback(err);
        return callback(null, { affectedRows: results.affectedRows });
    });
}

/**
 * Remove a product
 */
function remove(id, callback) {
    const sql = 'DELETE FROM products WHERE id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) return callback(err);
        return callback(null, { affectedRows: results.affectedRows });
    });
}

/**
 * Decrement stock by amount (non-negative).
 * Uses GREATEST to avoid negative stock.
 */
function decrementStock(id, amount, callback) {
    if (!id || !amount || amount <= 0) return callback(null);
    const sql = 'UPDATE products SET quantity = GREATEST(quantity - ?, 0) WHERE id = ?';
    db.query(sql, [amount, id], (err, results) => {
        if (err) return callback(err);
        return callback(null, { affectedRows: results.affectedRows });
    });
}

module.exports = {
    getById,
    getAll,
    create,
    update,
    delete: remove,
    decrementStock
};