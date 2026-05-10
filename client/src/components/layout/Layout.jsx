import React from 'react';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#f6f6f6]">
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      <footer className="bg-white border-t border-gray-100 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© 2026 TEMU CLONE. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <a href="#" className="hover:text-[#fb7701]">Terms of Service</a>
            <a href="#" className="hover:text-[#fb7701]">Privacy Policy</a>
            <a href="#" className="hover:text-[#fb7701]">Help Center</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
