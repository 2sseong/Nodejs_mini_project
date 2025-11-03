document.getElementById('load').addEventListener('click', async () => {
    const res = await fetch('/api/items');    // 같은 오리진 → CORS 걱정 X
    const data = await res.json();
    document.getElementById('out').textContent = JSON.stringify(data, null, 2);
});