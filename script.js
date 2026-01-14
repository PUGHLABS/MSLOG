const menu = document.querySelector('#mobile-menu');
const navList = document.querySelector('#nav-list');

menu.addEventListener('click', () => {
    navList.classList.toggle('active');
});