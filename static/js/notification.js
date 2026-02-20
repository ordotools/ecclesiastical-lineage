// Canonical notification for editor and form panels (non-module)
(function () {
  function showNotification(message, type) {
    type = type || 'info';
    var notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
      notificationContainer = document.createElement('div');
      notificationContainer.id = 'notification-container';
      notificationContainer.style.cssText =
        'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
      document.body.appendChild(notificationContainer);
    }

    var notification = document.createElement('div');
    var alertClass =
      type === 'error'
        ? 'alert-danger'
        : type === 'success'
          ? 'alert-success'
          : type === 'warning'
            ? 'alert-warning'
            : 'alert-info';
    notification.className = 'alert ' + alertClass + ' alert-dismissible fade show';
    notification.style.cssText =
      'margin-bottom: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: none; border-radius: 8px;';

    var icon =
      type === 'error'
        ? 'exclamation-triangle'
        : type === 'success'
          ? 'check-circle'
          : 'info-circle';
    notification.innerHTML =
      '<i class="fas fa-' +
      icon +
      ' me-2"></i>' +
      message +
      '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';

    notificationContainer.appendChild(notification);

    setTimeout(function () {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  window.showNotification = showNotification;
})();
