/**
 * Interactive ASCII Globe with Mouse Repulsion
 * A rotating 3D globe made of ASCII characters that react to mouse movement
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  function initGlobe() {
    const canvas = document.getElementById('ascii-globe-canvas');
    if (!canvas) {
      // Retry if canvas not found yet
      setTimeout(initGlobe, 100);
      return;
    }

    const ctx = canvas.getContext('2d');
    const container = document.getElementById('ascii-globe-container');
    if (!container) return;

    // Configuration
    const GLOBE_CHARS = ['@', '#', '*', '+', '=', '-', ':', '.', 'o', 'O', '0', '%', '&'];
    const POINT_COUNT = 600;
    const GLOBE_RADIUS = 110;
    const ROTATION_SPEED = 0.002;
    const MOUSE_RADIUS = 100;
    const REPEL_STRENGTH = 25;
    const RETURN_SPEED = 0.06;
    const FRICTION = 0.88;

    let width, height;
    let mouseX = -1000;
    let mouseY = -1000;
    let isMouseInCanvas = false;
    let rotation = 0;
    let animationId;

    // Particle class for each ASCII character
    class Particle {
      constructor(theta, phi) {
        this.theta = theta;
        this.phi = phi;
        this.char = GLOBE_CHARS[Math.floor(Math.random() * GLOBE_CHARS.length)];
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.vx = 0;
        this.vy = 0;
        this.baseSize = 8 + Math.random() * 6;
        this.depth = 0;
        this.originalTheta = theta;
        this.originalPhi = phi;
      }

      update(rotationY) {
        // Calculate 3D position on sphere
        const x3d = GLOBE_RADIUS * Math.sin(this.phi) * Math.cos(this.theta + rotationY);
        const y3d = GLOBE_RADIUS * Math.cos(this.phi);
        const z3d = GLOBE_RADIUS * Math.sin(this.phi) * Math.sin(this.theta + rotationY);

        // Project to 2D with perspective
        const perspective = 350;
        const scale = perspective / (perspective + z3d + GLOBE_RADIUS);

        this.targetX = width / 2 + x3d * scale;
        this.targetY = height / 2 + y3d * scale;
        this.depth = z3d;

        // Mouse repulsion with explosive effect
        if (isMouseInCanvas) {
          const dx = this.x - mouseX;
          const dy = this.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MOUSE_RADIUS && dist > 0) {
            const force = Math.pow((MOUSE_RADIUS - dist) / MOUSE_RADIUS, 2) * REPEL_STRENGTH;
            const angle = Math.atan2(dy, dx);

            // Add some randomness for more organic shattering
            const randomAngle = angle + (Math.random() - 0.5) * 0.5;
            this.vx += Math.cos(randomAngle) * force;
            this.vy += Math.sin(randomAngle) * force;
          }
        }

        // Spring back to target position
        const springX = (this.targetX - this.x) * RETURN_SPEED;
        const springY = (this.targetY - this.y) * RETURN_SPEED;

        this.vx += springX;
        this.vy += springY;

        // Apply friction
        this.vx *= FRICTION;
        this.vy *= FRICTION;

        // Update position
        this.x += this.vx;
        this.y += this.vy;
      }

      draw(ctx) {
        // Only draw particles on the front half of the globe (with some buffer)
        if (this.depth < 30) {
          const normalizedDepth = (this.depth + GLOBE_RADIUS) / (GLOBE_RADIUS * 2);
          const alpha = Math.max(0.1, 0.15 + normalizedDepth * 0.85);
          const size = this.baseSize * (0.4 + normalizedDepth * 0.6);

          // Calculate displacement for visual feedback
          const displacement = Math.sqrt(
            Math.pow(this.x - this.targetX, 2) +
            Math.pow(this.y - this.targetY, 2)
          );

          // Gold theme colors matching the site (#D4A63A)
          // Shift toward brighter/whiter when displaced
          const hue = 43;
          const saturation = Math.max(30, 70 - displacement * 0.5);
          const lightness = Math.min(80, 45 + normalizedDepth * 25 + displacement * 0.3);

          ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
          ctx.font = `${size}px "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(this.char, this.x, this.y);
        }
      }
    }

    let particles = [];

    function init() {
      // Set canvas size
      const rect = container.getBoundingClientRect();
      width = rect.width || 600;
      height = Math.min(400, window.innerHeight * 0.5);

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.scale(dpr, dpr);

      // Create particles distributed on sphere using golden spiral (Fibonacci sphere)
      particles = [];
      const goldenRatio = (1 + Math.sqrt(5)) / 2;

      for (let i = 0; i < POINT_COUNT; i++) {
        const theta = 2 * Math.PI * i / goldenRatio;
        const phi = Math.acos(1 - 2 * (i + 0.5) / POINT_COUNT);

        const particle = new Particle(theta, phi);
        // Initialize at center, will animate to position
        particle.x = width / 2;
        particle.y = height / 2;
        particles.push(particle);
      }
    }

    function animate() {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Slow rotation
      rotation += ROTATION_SPEED;

      // Update all particles
      particles.forEach(p => p.update(rotation));

      // Sort by depth (back to front) for proper layering
      particles.sort((a, b) => a.depth - b.depth);

      // Draw all visible particles
      particles.forEach(p => p.draw(ctx));

      animationId = requestAnimationFrame(animate);
    }

    // Mouse event handlers
    function handleMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      isMouseInCanvas = true;
    }

    function handleMouseLeave() {
      isMouseInCanvas = false;
      mouseX = -1000;
      mouseY = -1000;
    }

    function handleTouchMove(e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      mouseX = touch.clientX - rect.left;
      mouseY = touch.clientY - rect.top;
      isMouseInCanvas = true;
    }

    function handleTouchEnd() {
      isMouseInCanvas = false;
      mouseX = -1000;
      mouseY = -1000;
    }

    // Handle window resize
    let resizeTimeout;
    function handleResize() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const rect = container.getBoundingClientRect();
        if (Math.abs(rect.width - width) > 10) {
          init();
        }
      }, 150);
    }

    // Set up event listeners
    canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('resize', handleResize, { passive: true });

    // Initialize and start animation
    init();
    animate();

    // Store cleanup function
    window._asciiGlobeCleanup = function() {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResize);
    };
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobe);
  } else {
    initGlobe();
  }

  // Also try on page navigation (for SPA behavior)
  if (typeof window !== 'undefined') {
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(initGlobe, 200);
      }
    }).observe(document, { subtree: true, childList: true });
  }
})();
