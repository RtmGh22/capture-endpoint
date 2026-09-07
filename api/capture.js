export default async function handler(req, res) {
    if (req.method === 'GET') {
        res.status(200).json({ success: true, message: 'Endpoint active. Use POST to capture data.' });
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { type, content, timestamp } = req.body;
    console.log(`[CAPTURE] [${type}] ${content} at ${timestamp}`);
    res.status(200).json({ success: true });
}
