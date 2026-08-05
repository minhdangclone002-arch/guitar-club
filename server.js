require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const supabaseUrl = process.env.SUPABASE_URL || 'https://wtvoatrmrakatuxyukox.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dm9hdHJtcmFrYXR1eHl1a294Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjU3OTMsImV4cCI6MjEwMTQwMTc5M30.eYsaZBCHFmEPD7Rkr_PukOhhzLmYJsUBoNN17EMAo6U';

const supabase = createClient(supabaseUrl, supabaseKey);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận file ảnh hoặc video!'), false);
        }
    }
});

async function verifyAdmin(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Yêu cầu đăng nhập' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ' });
        }

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
            return res.status(403).json({ error: 'Không có quyền truy cập' });
        }

        req.user = user;
        next();
    } catch (err) {
        res.status(500).json({ error: 'Lỗi xác thực quyền' });
    }
}

app.get('/api/media', async (req, res) => {
    try {
        const { data, error } = await supabase.from('media_table').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/upload', verifyAdmin, upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Không có file được chọn' });

        const isVideo = file.mimetype.startsWith('video/');
        const mediaType = isVideo ? 'video' : 'image';
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${Date.now()}-${cleanName}`;

        const { error: uploadError } = await supabase.storage
            .from('media-gallery')
            .upload(fileName, file.buffer, { contentType: file.mimetype });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('media-gallery').getPublicUrl(fileName);
        const { data: insertData, error: insertError } = await supabase
            .from('media_table')
            .insert([{ url: publicUrlData.publicUrl, type: mediaType, file_name: fileName }])
            .select();

        if (insertError) throw insertError;

        res.json({ success: true, data: insertData[0] });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi tải lên' });
    }
});

app.delete('/api/media/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const { data: media } = await supabase.from('media_table').select('file_name').eq('id', id).single();
        if (media && media.file_name) {
            await supabase.storage.from('media-gallery').remove([media.file_name]);
        }
        const { error } = await supabase.from('media_table').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server đang chạy tại cổng ${PORT}`));
