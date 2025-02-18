// Counter animation function
const animateCounter = (element, target) => {
    let current = 0;
    const increment = target / 50;
    const duration = 2000;
    const stepTime = duration / 50;

    const counter = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target + (element.dataset.suffix || '');
            clearInterval(counter);
        } else {
            element.textContent = Math.floor(current) + (element.dataset.suffix || '');
        }
    }, stepTime);
};

// Intersection Observer for triggering animations
const observeStats = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumbers = entry.target.querySelectorAll('.stat-number');
            statNumbers.forEach(stat => {
                const target = parseFloat(stat.dataset.target);
                animateCounter(stat, target);
            });
            observeStats.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

// Initialize animations when document loads
document.addEventListener('DOMContentLoaded', () => {
    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
        observeStats.observe(statsSection);
    }

    // Add scroll reveal animations
    const revealElements = document.querySelectorAll('.feature-card, .step, .testimonial-card');
    revealElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 200 * index);
    });
});