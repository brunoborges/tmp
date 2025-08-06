const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const EventAnalyzer = require('./analyzer');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"]
        }
    }
}));

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Initialize analyzer
let analyzer;
try {
    analyzer = new EventAnalyzer('./output.json');
    console.log('✅ Event data loaded successfully');
} catch (error) {
    console.error('❌ Error loading event data:', error.message);
    process.exit(1);
}

// API Routes
app.get('/api/analytics', (req, res) => {
    try {
        const analytics = analyzer.getFullAnalysis();
        res.json({ success: true, data: analytics });
    } catch (error) {
        console.error('Error generating analytics:', error);
        res.status(500).json({ success: false, error: 'Failed to generate analytics' });
    }
});

app.get('/api/talks', (req, res) => {
    try {
        const { search, type, date, speaker } = req.query;
        let talks = analyzer.talks;

        // Apply filters
        if (search) {
            const searchLower = search.toLowerCase();
            talks = talks.filter(talk => 
                (talk.title && talk.title.toLowerCase().includes(searchLower)) ||
                (talk.abstract && talk.abstract.toLowerCase().includes(searchLower))
            );
        }

        if (type && type !== 'all') {
            talks = talks.filter(talk => talk.type === type);
        }

        if (date && date !== 'all') {
            talks = talks.filter(talk => 
                talk.times && talk.times.some(time => time.date === date)
            );
        }

        if (speaker && speaker !== 'all') {
            talks = talks.filter(talk => 
                talk.participants && talk.participants.some(p => 
                    (p.fullName && p.fullName.toLowerCase().includes(speaker.toLowerCase())) ||
                    (p.globalFullName && p.globalFullName.toLowerCase().includes(speaker.toLowerCase()))
                )
            );
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        const paginatedTalks = talks.slice(startIndex, endIndex);

        res.json({
            success: true,
            data: {
                talks: paginatedTalks,
                totalTalks: talks.length,
                totalPages: Math.ceil(talks.length / limit),
                currentPage: page
            }
        });
    } catch (error) {
        console.error('Error fetching talks:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch talks' });
    }
});

app.get('/api/talk/:id', (req, res) => {
    try {
        const { id } = req.params;
        const talk = analyzer.talks.find(t => t.sessionID === id || t.code === id);
        
        if (!talk) {
            return res.status(404).json({ success: false, error: 'Talk not found' });
        }

        res.json({ success: true, data: talk });
    } catch (error) {
        console.error('Error fetching talk:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch talk details' });
    }
});

app.get('/api/speakers', (req, res) => {
    try {
        const speakerAnalysis = analyzer.getSpeakerAnalysis();
        res.json({ success: true, data: speakerAnalysis.speakers });
    } catch (error) {
        console.error('Error fetching speakers:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch speakers' });
    }
});

app.get('/api/export/:format', (req, res) => {
    try {
        const { format } = req.params;
        const analytics = analyzer.getFullAnalysis();
        
        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=ibm-event-analytics.json');
            res.json(analytics);
        } else {
            res.status(400).json({ success: false, error: 'Unsupported export format' });
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ success: false, error: 'Failed to export data' });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`🚀 IBM Events Analytics Dashboard running on http://localhost:${PORT}`);
    console.log(`📊 Analyzing ${analyzer.talks.length} talks from IBM TechXchange 2025`);
});
