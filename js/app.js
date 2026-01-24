/**
 * i-am pdf - Main Application JavaScript
 * Handles navigation, FAQ, and general UI interactions
 */

(function() {
  'use strict';

  // ========================================
  // Mobile Navigation
  // ========================================
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');

  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', function() {
      mobileNav.classList.toggle('active');
      
      // Toggle aria-expanded
      const isExpanded = mobileNav.classList.contains('active');
      mobileMenuBtn.setAttribute('aria-expanded', isExpanded);
    });

    // Close mobile nav when clicking outside
    document.addEventListener('click', function(e) {
      if (!mobileNav.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        mobileNav.classList.remove('active');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Close mobile nav when pressing Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
        mobileNav.classList.remove('active');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ========================================
  // FAQ Accordion
  // ========================================
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(function(item) {
    const question = item.querySelector('.faq-question');
    
    if (question) {
      question.addEventListener('click', function() {
        // Close other FAQ items
        faqItems.forEach(function(otherItem) {
          if (otherItem !== item && otherItem.classList.contains('active')) {
            otherItem.classList.remove('active');
            otherItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
          }
        });

        // Toggle current item
        item.classList.toggle('active');
        const isExpanded = item.classList.contains('active');
        question.setAttribute('aria-expanded', isExpanded);
      });
    }
  });

  // ========================================
  // Smooth Scroll for Anchor Links
  // ========================================
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      
      if (targetId !== '#') {
        e.preventDefault();
        const target = document.querySelector(targetId);
        
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });

          // Close mobile nav if open
          if (mobileNav && mobileNav.classList.contains('active')) {
            mobileNav.classList.remove('active');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
          }
        }
      }
    });
  });

  // ========================================
  // Intersection Observer for Animations
  // ========================================
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe feature cards and tool cards for animation
  document.querySelectorAll('.feature-card, .tool-card').forEach(function(card) {
    card.style.opacity = '0';
    observer.observe(card);
  });

  // ========================================
  // Lazy Load Images
  // ========================================
  if ('loading' in HTMLImageElement.prototype) {
    // Browser supports native lazy loading
    document.querySelectorAll('img[data-src]').forEach(function(img) {
      img.src = img.dataset.src;
      img.loading = 'lazy';
    });
  } else {
    // Fallback for older browsers
    const lazyImages = document.querySelectorAll('img[data-src]');
    
    if (lazyImages.length > 0) {
      const lazyObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            lazyObserver.unobserve(img);
          }
        });
      });

      lazyImages.forEach(function(img) {
        lazyObserver.observe(img);
      });
    }
  }

  // ========================================
  // Utility Functions
  // ========================================
  
  /**
   * Format file size to human readable
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  window.formatFileSize = function(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /**
   * Generate a unique filename
   * @param {string} baseName - Base name for the file
   * @param {string} extension - File extension
   * @param {number} index - Page/file index
   * @returns {string} Formatted filename
   */
  window.generateFileName = function(baseName, extension, index) {
    const cleanName = baseName.replace(/\.[^/.]+$/, ''); // Remove extension if exists
    return cleanName + '_page_' + (index + 1) + '.' + extension;
  };

  // Log initialization
  console.log('i-am pdf app initialized');

})();
