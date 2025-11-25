const productModel = require('../models/product');

function list(req, res) {
    productModel.getAll(function (err, products) {
        const user = req.session.user || null;

        if (err) {
            req.flash('error', err.message || err);
            return res.status(500).redirect('/');
        }

        if (user && user.role === 'admin') {
            return res.render('inventory', { 
                products, 
                user, 
                messages: req.flash('error') || [] 
            });
        } else {
            return res.render('shopping', { 
                products, 
                user, 
                messages: req.flash('error') || [] 
            });
        }
    });
}

function getById(req, res) {
    const id = parseInt(req.params.id, 10);
    productModel.getById(id, function (err, product) {
        if (err) {
            req.flash('error', err.message || err);
            return res.status(500).redirect('/');
        }

        if (!product) {
            req.flash('error', 'Product not found');
            return res.redirect('/shopping');
        }

        res.render('product', { 
            product, 
            user: req.session.user, 
            messages: req.flash('error') || [] 
        });
    });
}

function renderEdit(req, res) {
    const id = parseInt(req.params.id, 10);
    productModel.getById(id, function (err, product) {
        if (err) {
            req.flash('error', err.message || err);
            return res.redirect('/inventory');
        }

        if (!product) {
            req.flash('error', 'Product not found');
            return res.redirect('/inventory');
        }

        res.render('updateProduct', { 
            product, 
            user: req.session.user,
            messages: req.flash('error') || [],
            success: req.flash('success') || []
        });
    });
}

function add(req, res) {
    const product = {
        ProductName: req.body.ProductName || req.body.name,
        quantity: req.body.quantity,
        price: req.body.price,
        image: req.file ? req.file.filename : (req.body.image || null)
    };

    if (!product.ProductName) {
        req.flash('error', 'Product Name is required');
        return res.redirect('/addProduct');
    }

    productModel.add(product, function (err) {
        if (err) {
            req.flash('error', err.message || err);
            return res.redirect('/addProduct');
        }

        req.flash('success', 'Product added successfully!');
        res.redirect('/inventory');
    });
}

function update(req, res) {
    const id = parseInt(req.params.id, 10);
    let image = req.body.currentImage || null;
    if (req.file) image = req.file.filename;

    const product = {
        ProductName: req.body.ProductName,
        quantity: req.body.quantity,
        price: req.body.price,
        image: image
    };

    productModel.update(id, product, function (err, result) {
        if (err) {
            req.flash('error', err.message || err);
            return res.redirect('/updateProduct/' + id);
        }

        if (!result || result.affectedRows === 0) {
            req.flash('error', 'Product not found or not changed');
            return res.redirect('/updateProduct/' + id);
        }

        req.flash('success', 'Product updated successfully!');
        res.redirect('/inventory');
    });
}

function remove(req, res) {
    const id = parseInt(req.params.id, 10);
    productModel.delete(id, function (err, result) {
        if (err) {
            req.flash('error', err.message || err);
            return res.redirect('/inventory');
        }

        if (!result || result.affectedRows === 0) {
            req.flash('error', 'Product not found');
            return res.redirect('/inventory');
        }

        req.flash('success', 'Product deleted successfully!');
        res.redirect('/inventory');
    });
}

module.exports = {
    list,
    getById,
    renderEdit,
    add,
    update,
    delete: remove,
    remove
};
