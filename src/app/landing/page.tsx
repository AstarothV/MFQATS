'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { Star, ArrowRight, Menu, X, Hammer, Layers, Zap, Shield, Truck, Award, Phone, Mail, MapPin, Eye, ShoppingBag, Users, CheckCircle2, Smartphone } from 'lucide-react';

const navLinks = [
{ label: 'Home', href: '#home' },
{ label: 'Products', href: '#products' },
{ label: 'About', href: '#about' },
{ label: 'How It Works', href: '#how-it-works' },
{ label: 'Contact', href: '#contact' }];


const featuredProducts = [
{
  name: 'Oak Dining Table',
  category: 'Tables',
  price: 1240,
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_13d329e25-1772441226671.png',
  alt: 'Solid oak dining table with curved legs and natural wood grain finish',
  rating: 4.8,
  reviews: 24
},
{
  name: 'Walnut Bookshelf',
  category: 'Storage',
  price: 890,
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_17c6d1e91-1772199203166.png',
  alt: 'Modern walnut bookshelf with five adjustable shelves and minimalist design',
  rating: 4.6,
  reviews: 18
},
{
  name: 'Cherry Coffee Table',
  category: 'Tables',
  price: 650,
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_164fe4caf-1764651052330.png',
  alt: 'Cherry wood coffee table with hidden storage compartment and tapered legs',
  rating: 4.7,
  reviews: 31
},
{
  name: 'Cherry Bed Frame',
  category: 'Beds',
  price: 1580,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_10dfcefad-1772601618690.png",
  alt: 'Luxury cherrywood bed frame with low-profile rails and reinforced joinery',
  rating: 4.9,
  reviews: 8
}];


const orderSteps = [
{ step: 1, title: 'Browse & Select', desc: 'Explore our handcrafted furniture catalog. Use AR preview to see pieces in your space.', icon: Eye },
{ step: 2, title: 'Customize & Order', desc: 'Choose materials, dimensions, and finishes. Add to cart and place your order.', icon: ShoppingBag },
{ step: 3, title: 'We Craft It', desc: 'Our master woodworkers build your furniture with precision quality control at every stage.', icon: Hammer },
{ step: 4, title: 'Track & Receive', desc: 'Monitor real-time production progress and receive your furniture with white-glove delivery.', icon: Truck }];


const testimonials = [
{
  name: 'Claire Leblanc',
  role: 'Interior Designer',
  text: 'The quality of MVCA furniture is unmatched. The AR preview feature helped me visualize exactly how the dining table would look in my client\'s home.',
  rating: 5,
  avatar: 'CL'
},
{
  name: 'Mark Walton',
  role: 'Homeowner',
  text: 'I could track every stage of production in real-time. When my bookshelf was being assembled, I received photos from the workshop. Incredible transparency!',
  rating: 5,
  avatar: 'MW'
},
{
  name: 'Nina Park',
  role: 'Architect',
  text: 'The custom dimensions feature is perfect for my projects. MVCA delivered exactly what was specified, with quality that exceeded expectations.',
  rating: 5,
  avatar: 'NP'
}];


const whyChoose = [
{ icon: Award, title: 'Master Craftsmanship', desc: 'Every piece is handcrafted by skilled woodworkers with 10+ years of experience.' },
{ icon: Shield, title: 'Quality Guaranteed', desc: 'AI-powered quality inspection at every production stage ensures perfection.' },
{ icon: Smartphone, title: 'AR Visualization', desc: 'Preview furniture in your actual space with true-to-scale AR technology.' },
{ icon: Layers, title: 'Real-Time Tracking', desc: 'Monitor your order through every production stage with live updates.' },
{ icon: Zap, title: 'Fast Production', desc: 'Efficient workshop processes deliver your custom furniture in 14-21 days.' },
{ icon: Users, title: 'Dedicated Support', desc: 'Direct chat with our production team for any questions or updates.' }];


export default function LandingPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  function scrollTo(id: string) {
    setMobileMenuOpen(false);
    if (id.startsWith('#')) {
      const el = document.getElementById(id.slice(1));
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-card/95 backdrop-blur-sm border-b border-border shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <AppLogo size={32} />
              <span className="text-base font-bold text-foreground">MVCA WoodWorks</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) =>
              <button key={link.label} type="button" onClick={() => scrollTo(link.href)} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  {link.label}
                </button>
              )}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/sign-up-login-screen" className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                Login
              </Link>
              <Link href="/sign-up-login-screen?tab=register" className="btn-primary text-sm px-4 py-2">
                Register
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden btn-ghost p-2">
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen &&
        <div className="md:hidden bg-card border-b border-border px-4 py-4 space-y-2">
            {navLinks.map((link) =>
          <button key={link.label} type="button" onClick={() => scrollTo(link.href)} className="block w-full text-left px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                {link.label}
              </button>
          )}
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/sign-up-login-screen" className="btn-secondary text-sm text-center">Login</Link>
              <Link href="/sign-up-login-screen?tab=register" className="btn-primary text-sm text-center">Register</Link>
            </div>
          </div>
        }
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary mb-8">
            <Zap size={14} /> AI-Powered Quality Assurance & Tracking
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
            Handcrafted Furniture
            <br />
            <span className="text-primary">Built to Perfection</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
            MVCA WoodWorks combines master craftsmanship with cutting-edge technology. 
            Preview furniture in AR, track production in real-time, and receive quality-guaranteed pieces.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up-login-screen?tab=register" className="btn-primary text-base px-8 py-4 flex items-center gap-2">
              <ShoppingBag size={18} /> Browse Products <ArrowRight size={16} />
            </Link>
            <Link href="/sign-up-login-screen" className="btn-secondary text-base px-8 py-4 flex items-center gap-2">
              Login to Dashboard
            </Link>
          </div>
          <div className="mt-12 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
            { value: '500+', label: 'Happy Customers' },
            { value: '14 Days', label: 'Avg. Production' },
            { value: '99%', label: 'Quality Pass Rate' }].
            map((stat) =>
            <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm text-primary uppercase tracking-[0.24em] mb-3">About MVCA</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
                Where Tradition Meets Technology
              </h2>
              <p className="text-muted-foreground mb-4">
                MVCA WoodWorks has been crafting premium furniture for over two decades. 
                Our master woodworkers combine traditional joinery techniques with modern precision tools 
                to create pieces that last generations.
              </p>
              <p className="text-muted-foreground mb-6">
                We've integrated AI-powered quality assurance, real-time production tracking, and 
                augmented reality visualization to give our customers complete transparency and confidence 
                in every purchase.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                { label: 'Years of Experience', value: '20+' },
                { label: 'Products Crafted', value: '10,000+' },
                { label: 'Wood Species Used', value: '15+' },
                { label: 'Quality Checkpoints', value: '7 Stages' }].
                map((item) =>
                <div key={item.label} className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xl font-bold text-primary">{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <img
                src="https://img.rocket.new/generatedImages/rocket_gen_img_18c01684c-1767919236400.png"
                alt="Master woodworker crafting an oak dining table in the MVCA workshop"
                className="rounded-3xl object-cover h-48 w-full" />
              
              <img
                src="https://img.rocket.new/generatedImages/rocket_gen_img_1aef25360-1779359429586.png"
                alt="Quality inspection of furniture joints and wood grain in production"
                className="rounded-3xl object-cover h-48 w-full mt-8" />
              
              <img
                src="https://img.rocket.new/generatedImages/rocket_gen_img_1dd2e4284-1764650558520.png"
                alt="Finished walnut bookshelf with natural wood finish ready for delivery"
                className="rounded-3xl object-cover h-48 w-full" />
              
              <img
                src="https://img.rocket.new/generatedImages/rocket_gen_img_105d53b9a-1772882308126.png"
                alt="Cherry wood bed frame with luxury finish in the showroom"
                className="rounded-3xl object-cover h-48 w-full mt-8" />
              
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section id="products" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm text-primary uppercase tracking-[0.24em] mb-3">Our Collection</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Featured Furniture</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Each piece is handcrafted with premium wood species and finished to perfection.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) =>
            <div key={product.name} className="rounded-3xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all duration-200 group">
                <div className="relative overflow-hidden h-48">
                  <img src={product.image} alt={product.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute top-3 left-3 bg-card/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-foreground">
                    {product.category}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-1">{product.name}</h3>
                  <div className="flex items-center gap-1 mb-2">
                    <Star size={12} className="text-warning fill-warning" />
                    <span className="text-xs font-semibold text-foreground">{product.rating}</span>
                    <span className="text-xs text-muted-foreground">({product.reviews})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-foreground">${product.price.toLocaleString()}</span>
                    <Link href="/sign-up-login-screen?tab=register" className="text-xs text-primary font-semibold hover:underline">
                      Order Now →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="text-center mt-8">
            <Link href="/sign-up-login-screen?tab=register" className="btn-primary inline-flex items-center gap-2">
              View All Products <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm text-primary uppercase tracking-[0.24em] mb-3">Process</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">How Ordering Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From browsing to delivery, we make the process simple and transparent.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {orderSteps.map((step, idx) => {
              const StepIcon = step.icon;
              return (
                <div key={step.step} className="relative">
                  {idx < orderSteps.length - 1 &&
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-border z-0" style={{ width: 'calc(100% - 2rem)' }} />
                  }
                  <div className="relative z-10 rounded-3xl border border-border bg-card p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <StepIcon size={24} className="text-primary" />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mx-auto mb-3">
                      {step.step}
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </div>);

            })}
          </div>
        </div>
      </section>

      {/* AR Preview Showcase */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/5 to-background p-8 lg:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-sm text-primary uppercase tracking-[0.24em] mb-3">AR Technology</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                  See It In Your Space Before You Buy
                </h2>
                <p className="text-muted-foreground mb-6">
                  Our true-to-scale AR visualization lets you place any furniture piece in your actual room. 
                  See exact dimensions, rotate, zoom, and compare sizes before placing your order.
                </p>
                <ul className="space-y-3 mb-8">
                  {['True-to-scale dimensions from product specs', 'Place in your real environment', 'Rotate and zoom for full view', 'Works on mobile and tablet'].map((feat) =>
                  <li key={feat} className="flex items-center gap-3 text-sm text-foreground">
                      <CheckCircle2 size={16} className="text-success shrink-0" />
                      {feat}
                    </li>
                  )}
                </ul>
                <Link href="/sign-up-login-screen?tab=register" className="btn-primary inline-flex items-center gap-2">
                  <Smartphone size={16} /> Try AR Preview
                </Link>
              </div>
              <div className="relative">
                <div className="rounded-3xl bg-gradient-to-br from-violet-200 via-purple-200 to-white dark:from-purple-950 dark:via-violet-900 dark:to-slate-950 p-8 min-h-[300px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-32 h-24 mx-auto rounded-2xl border border-violet-300/60 bg-violet-400/25 backdrop-blur-sm flex items-center justify-center mb-4">
                      <div className="text-center">
                        <div className="text-4xl">🪑</div>
                        <p className="text-xs text-foreground/80 mt-1">Oak Dining Table</p>
                      </div>
                    </div>
                    <div className="mx-auto h-3 w-32 rounded-full bg-violet-500/40 blur-sm mb-4" />
                    <p className="text-sm text-muted-foreground">180 × 90 × 75 cm</p>
                    <p className="text-xs text-muted-foreground mt-1">True-to-scale AR Preview</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose MVCA */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm text-primary uppercase tracking-[0.24em] mb-3">Why MVCA</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Why Choose MVCA WoodWorks</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyChoose.map((item) => {
              const ItemIcon = item.icon;
              return (
                <div key={item.title} className="rounded-3xl border border-border bg-card p-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <ItemIcon size={22} className="text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>);

            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm text-primary uppercase tracking-[0.24em] mb-3">Testimonials</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">What Our Customers Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) =>
            <div key={t.name} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) =>
                <Star key={i} size={14} className="text-warning fill-warning" />
                )}
                </div>
                <p className="text-sm text-muted-foreground mb-4 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <p className="text-sm text-primary uppercase tracking-[0.24em] mb-3">Contact</p>
              <h2 className="text-3xl font-bold text-foreground mb-4">Get In Touch</h2>
              <p className="text-muted-foreground mb-8">
                Have questions about our products or want to discuss a custom order? We'd love to hear from you.
              </p>
              <div className="space-y-4">
                {[
                { icon: MapPin, label: 'Address', value: '123 Woodcraft Lane, Manila, Philippines' },
                { icon: Phone, label: 'Phone', value: '+63 912 345 6789' },
                { icon: Mail, label: 'Email', value: 'hello@mvcawood.com' }].
                map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                        <ItemIcon size={18} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-sm font-medium text-foreground">{item.value}</p>
                      </div>
                    </div>);

                })}
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Ready to Order?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Create an account to browse our full catalog, use AR preview, and place your custom order.
              </p>
              <div className="space-y-3">
                <Link href="/sign-up-login-screen?tab=register" className="btn-primary w-full flex items-center justify-center gap-2">
                  <ShoppingBag size={16} /> Create Account & Browse
                </Link>
                <Link href="/sign-up-login-screen" className="btn-secondary w-full flex items-center justify-center gap-2">
                  Login to Existing Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AppLogo size={24} />
              <span className="text-sm font-semibold text-foreground">MVCA WoodWorks</span>
            </div>
            <p className="text-xs text-muted-foreground">© 2026 MVCA WoodWorks. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link href="/sign-up-login-screen" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Login</Link>
              <Link href="/sign-up-login-screen?tab=register" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Register</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>);

}