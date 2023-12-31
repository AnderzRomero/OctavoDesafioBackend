import { cartsService } from "../services/index.js";
import { productsService } from "../services/index.js";
import { ticketsService } from "../services/index.js";
import __dirname from "../utils.js";

const getCart = async (req, res) => {
    const cid = req.user.cart;
    const cart = await cartsService.getCartBy({ _id: cid });
    if (!cart) return res.status(400).send({ status: "error", error: "Carrito no encontrado" });
    res.render('Carts', {
        css: 'carts',
        cart: cart
    })
}

const getCartCompra = async (req, res) => {
    try {
        const user = req.user;
        const cid = req.user.cart;
        const cart = await cartsService.getCartBy({ _id: cid });
        if (!cart) return res.status(400).send({ status: "error", error: "Carrito no encontrado" });
        res.render('tickets', {
            css: 'tickets',    
            cart: cart,
            user: user
        })
    } catch (error) {
        res.status(400).send({ status: "error", message: "Carrito no encontrado" });
    }
}

const createCart = async (req, res) => {
    const cart = await cartsService.createCart();
    if (cart) return res.status(201).send({ status: "success", message: "Carrito creado", payload: cart._id });
    res.status(400).send({ message: "Error al crear carrito" });
}

const purchaseCart = async (req, res) => {
    try {
        const user = req.user;
        const cartId = req.user.cart;
        const productPurchase = []; // Almacenará los productos comprados
        const productNotPurchased = []; // Almacenará los productos que no tienen Stock

        try {
            const cart = await cartsService.getCartBy({ _id: cartId });

            if (!cart) return res.status(404).send({ status: "error", message: "Carrito no encontrado" });

            // Verifica el stock de cada producto en el carrito
            const productsInCart = cart.products;


            for (const productInCart of productsInCart) {
                const productId = productInCart._id._id;
                const product = await productsService.getProductBy(productId);

                if (!product) {
                    console.log("No se ha podido obtener el producto con id ", productId);
                    continue;
                }
                if (productInCart.quantity > product.stock) {
                    productNotPurchased.push(productInCart);
                    continue;
                }

                product.stock -= productInCart.quantity;

                await productsService.updateProduct(productId, { stock: product.stock });
                productPurchase.push(productInCart);
            }
        } catch (error) {
            return res.status(500).send({ status: "error", message: " A ocurrido un error, mientras procesamos la compra" });
        }

        const total = productPurchase.reduce((acc, productInCart) => acc + productInCart._id.price * productInCart.quantity, 0);

        const codeTicket = Date.now().toString(15);

        const newTicket = {
            code: codeTicket,
            purchase_datetime: new Date().toISOString(),
            amount: total,
            purchaser: user.email,
            products: productPurchase
        }

        console.log("Informacion Ticket:", newTicket);

        try {
            await ticketsService.createTicket(newTicket);
            if (productNotPurchased.length > 0) {
                await cartsService.updateCart({ _id: cartId }, { products: productNotPurchased });
            }
        } catch (error) {
            return res.status(500).send({ status: "error", message: " A ocurrido un error, mientras procesamos la compra segundo" });
        }
        return res.status(200).send({ status: "success", message: "Compra exitosa", payload: newTicket });
    } catch (error) {
        return res.status(500).send("Error en el servidor: " + error.message);
    }
}

const updateProductInCartNO_AUTH = async (req, res) => {
    const { cid, pid } = req.params;
    // Vamos a ver si existen y traer sus entidades
    const cart = await cartsService.getCartBy({ _id: cid });
    if (!cart) return res.status(400).send({ status: "error", error: "Carrito no existe" });
    const product = await productsService.getProductBy({ _id: pid });
    if (!product) return res.status(400).send({ status: "error", error: "Producto no existe" });

    const productExisteInCarrito = cart.products.find(product => {
        return product._id._id.toString() === pid
    })
    if (productExisteInCarrito) {
        // Incrementar la cantidad del producto en el carrito
        productExisteInCarrito.quantity += 1;

        // Guardar los cambios en el carrito
        await cartsService.updateProductQuantity({ _id: cid }, cart.products);

        // Retornar una respuesta exitosa
        return res.status(200).send({ status: 'success', message: 'Cantidad del producto incrementada en el carrito' });
    } else {
        cart.products.push({
            _id: pid
        })
        const newproduct = { products: cart.products };
        await cartsService.updateCart({ _id: cid }, newproduct);
        res.send({ status: "success", message: "Producto agregado al carro" });
    }
}

const updateProductInCart = async (req, res) => {
    const { pid } = req.params;
    const cartId = req.user.cart;
    const cart = await cartsService.getCartBy({ _id: cartId });
    if (!cart) return res.status(400).send({ status: "error", error: "Carrito no existe" });
    const product = await productsService.getProductBy({ _id: pid });
    if (!product) return res.status(400).send({ status: "error", error: "Producto no existe" })

    const productExisteInCarrito = cart.products.find(product => {
        return product._id._id.toString() === pid
    })
    if (productExisteInCarrito) {
        // Incrementar la cantidad del producto en el carrito
        productExisteInCarrito.quantity += 1;

        // Guardar los cambios en el carrito
        await cartsService.updateProductQuantity({ _id: cartId }, cart.products);

        // Retornar una respuesta exitosa
        return res.status(200).send({ status: 'success', message: 'Cantidad del producto incrementada en el carrito' });
    } else {
        cart.products.push({
            _id: pid
        })
        const newproduct = { products: cart.products };
        await cartsService.updateCart({ _id: cartId }, newproduct);
        res.send({ status: "success", message: "Producto agregado al carro" });
    }
}

const deleteProductInCart = async (req, res) => {
    const { pid } = req.params;
    const cartId = req.user.cart;
    try {
        const carritoActualizado = await cartsService.removeProductFromCart(cartId, pid);
        res.status(200).send({ status: "success", message: "Producto eliminado del carrito", cart: carritoActualizado });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
}

const deleteAllProductsInCart = async (req, res) => {
    const cartId = req.user.cart;
    try {
        // Traigo el carrito al que eliminare los productos
        const cart = await cartsService.getCartBy({ _id: cartId });
        // Elimino todos los productos de dicho carrito y retorno la lista vacia
        if (cart) {
            const vaciarcart = { products: [] };
            await cartsService.deleteAllProductsInCart({ _id: cartId }, vaciarcart);
            return res.send({ status: "sucess", message: "Se vacio el carrito totalmente" });
        } else {
            return res.send({ status: "error", message: "Hubo un error, no se puede vaciar el carrito" });
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
}
export default {
    getCart,
    getCartCompra,
    createCart,
    purchaseCart,
    updateProductInCartNO_AUTH,
    updateProductInCart,
    deleteProductInCart,
    deleteAllProductsInCart,
}