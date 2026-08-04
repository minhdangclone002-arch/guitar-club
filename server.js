require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Phục vụ Frontend
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/media', async (req, res) => {
    const { data, error } = await supabase.from('media_table').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Không có file' });

        const isVideo = file.mimetype.startsWith('video/');
        const mediaType = isVideo ? 'video' : 'image';
        const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;

        const { error: uploadError } = await supabase.storage.from('media-gallery').upload(fileName, file.buffer, { contentType: file.mimetype });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('media-gallery').getPublicUrl(fileName);
        const { data: insertData, error: insertError } = await supabase.from('media_table').insert([{ url: publicUrlData.publicUrl, type: mediaType, file_name: fileName }]).select();
        if (insertError) throw insertError;

        res.json({ success: true, data: insertData[0] });
    } catch (error) { res.status(500).json({ error: 'Lỗi upload' }); }
});

app.delete('/api/media/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: media } = await supabase.from('media_table').select('file_name').eq('id', id).single();
        if (media && media.file_name) { await supabase.storage.from('media-gallery').remove([media.file_name]); }
        const { error } = await supabase.from('media_table').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Chạy tại cổng ${PORT}`));

