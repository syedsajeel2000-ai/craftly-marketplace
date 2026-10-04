import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import { PageLoader } from './components/ui.jsx';
import { ScrollProgress } from './components/motion.jsx';

const Home = lazy(() => import('./pages/Home.jsx'));
const Marketplace = lazy(() => import('./pages/Marketplace.jsx'));
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation.jsx'));
const Orders = lazy(() => import('./pages/Orders.jsx'));
const OrderDetail = lazy(() => import('./pages/OrderDetail.jsx'));
const Wishlist = lazy(() => import('./pages/Wishlist.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const Seller = lazy(() => import('./pages/Seller.jsx'));
const Shop = lazy(() => import('./pages/Shop.jsx'));
const Shops = lazy(() => import('./pages/Shops.jsx'));
const Info = lazy(() => import('./pages/Info.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

/** Scroll to top on route change (unless a search/hash navigation). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <ScrollProgress />
      <main id="main" className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense fallback={<PageLoader />}>
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/category/:slug" element={<Marketplace />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/order-confirmed/:id" element={<OrderConfirmation />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/orders/:id" element={<OrderDetail />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/account" element={<Account />} />
                <Route path="/seller/*" element={<Seller />} />
                <Route path="/shop/:username" element={<Shop />} />
                <Route path="/shops" element={<Shops />} />
                <Route path="/about" element={<Info page="about" />} />
                <Route path="/help" element={<Info page="help" />} />
                <Route path="/contact" element={<Info page="contact" />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
