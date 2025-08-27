// Password validation
document.getElementById('password').addEventListener('input', function() {
  const password = this.value;
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
  
  // Update requirement indicators
  document.getElementById('req-length').className = requirements.length ? 'text-success' : 'text-danger';
  document.getElementById('req-uppercase').className = requirements.uppercase ? 'text-success' : 'text-danger';
  document.getElementById('req-lowercase').className = requirements.lowercase ? 'text-success' : 'text-danger';
  document.getElementById('req-number').className = requirements.number ? 'text-success' : 'text-danger';
  document.getElementById('req-special').className = requirements.special ? 'text-success' : 'text-danger';
  
  // Check if passwords match
  const confirmPassword = document.getElementById('confirm_password').value;
  if (confirmPassword) {
    checkPasswordMatch();
  }
});

document.getElementById('confirm_password').addEventListener('input', checkPasswordMatch);

function checkPasswordMatch() {
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm_password').value;
  const confirmField = document.getElementById('confirm_password');
  
  if (confirmPassword && password !== confirmPassword) {
    confirmField.setCustomValidity('Passwords do not match');
    confirmField.classList.add('is-invalid');
  } else {
    confirmField.setCustomValidity('');
    confirmField.classList.remove('is-invalid');
  }
}
