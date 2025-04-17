function showNotification(message, color = '#fff', bgColor = '#333', duration = 3000) {
    const notification = document.createElement('div');
    notification.textContent = message;

    Object.assign(notification.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: bgColor,
        color: color,
        padding: '12px 20px',
        borderRadius: '10px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        opacity: '0',
        transform: 'translateY(20px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        zIndex: 9999,
    });

    document.body.appendChild(notification);
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        setTimeout(() => notification.remove(), 300);
    }, duration);

    // Also add to game log
    const log = document.getElementById('gameLog');
    const entry = document.createElement('div');
    entry.textContent = `▶ ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}
export { showNotification }