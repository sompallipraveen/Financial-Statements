document.addEventListener("DOMContentLoaded", () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                entry.target.style.opacity = 1;
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll(".feature-card").forEach((card) => {
        observer.observe(card);
    });
});
document.addEventListener("DOMContentLoaded", () => {
    // Set up Chart.js configurations
    const ctx1 = document.getElementById("auditStatusChart").getContext("2d");
    const ctx2 = document.getElementById("monthlyTrendsChart").getContext("2d");

    // Pie Chart for Audit Status
    new Chart(ctx1, {
        type: "doughnut",
        data: {
            labels: ["Completed", "In Progress", "Pending"],
            datasets: [
                {
                    label: "Audit Status",
                    data: [80, 45, 20],
                    backgroundColor: ["#4caf50", "#ff9800", "#f44336"],
                    borderColor: ["#ffffff"],
                    borderWidth: 2,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        font: {
                            size: 14,
                        },
                    },
                },
            },
        },
    });

    // Line Chart for Monthly Trends
    new Chart(ctx2, {
        type: "bar",
        data: {
            labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
            datasets: [
                {
                    label: "Monthly Audits",
                    data: [5, 10, 15, 20, 25, 30],
                    backgroundColor: "#4f46e5",
                    borderRadius: 8,
                    borderWidth: 0,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 12 } },
                },
                y: {
                    ticks: { stepSize: 5 },
                },
            },
        },
    });
});
