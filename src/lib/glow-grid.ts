export function trackGlowGrid(grid: HTMLElement) {
    grid.addEventListener("pointermove", (event) => {
        grid.querySelectorAll<HTMLElement>(".glow-card").forEach((card) => {
            const bounds = card.getBoundingClientRect();
            card.style.setProperty("--glow-x", `${event.clientX - bounds.left}px`);
            card.style.setProperty("--glow-y", `${event.clientY - bounds.top}px`);
        });
    });
}
