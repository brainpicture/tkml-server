// Экспортируем переменные просто присваивая их в this
userName = 'John Doe';
items = ['Item 1', 'Item 2', 'Item 3'];
count = 42;

// Можно также вычислять значения
const currentDate = new Date();
formattedDate = currentDate.toLocaleDateString();

// Или экспортировать функции
function formatPrice(price) {
    return `$${price.toFixed(2)}`;
}

// Объекты тоже работают
appInfo = {
    version: '1.0.0',
    author: 'TKML Team'
};

// Можно также использовать finish() для раннего завершения
if (get.mode === 'direct') {
    let content = '<list>';
    for (let i = 0; i < 5; i++) {
        content += `<section>Direct Item ${i + 1}</section>`;
    }
    content += '</list>';
    finish(content);
} 