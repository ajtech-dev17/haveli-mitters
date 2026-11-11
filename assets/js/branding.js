export function syncBranding(document, logo, name) {
  if (!logo) return;
  const icon = document.querySelector('link[rel="icon"]');
  if (icon && icon.getAttribute('href') !== logo) {
    icon.removeAttribute('type');
    icon.setAttribute('href', logo);
  }
  for (const image of document.querySelectorAll('.brand img, .auth-logo, .crest > img')) {
    if (image.getAttribute('src') !== logo) image.setAttribute('src', logo);
    image.setAttribute('alt', name);
  }
}
