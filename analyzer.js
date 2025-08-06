const fs = require('fs');
const path = require('path');

class EventAnalyzer {
    constructor(dataPath) {
        this.data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        this.talks = this.extractTalks();
    }

    extractTalks() {
        let talks = [];
        
        // Handle first page format (sectionList structure)
        if (this.data.sectionList && this.data.sectionList[0] && this.data.sectionList[0].items) {
            talks = this.data.sectionList[0].items;
        }
        // Handle pagination format (direct items)
        else if (this.data.items && Array.isArray(this.data.items)) {
            talks = this.data.items;
        }
        
        return talks;
    }

    // Clean HTML from text
    cleanText(text) {
        if (!text) return '';
        return text.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
    }

    // Get basic event statistics
    getBasicStats() {
        // Get unique talks by code/id to avoid counting repeats
        const uniqueTalks = new Map();
        
        this.talks.forEach(talk => {
            const key = talk.code || talk.id || talk.title;
            if (!uniqueTalks.has(key)) {
                uniqueTalks.set(key, talk);
            }
        });
        
        const totalTalks = uniqueTalks.size;
        const talkTypes = {};
        const languages = {};
        
        Array.from(uniqueTalks.values()).forEach(talk => {
            // Count talk types
            const type = talk.type || 'Unknown';
            talkTypes[type] = (talkTypes[type] || 0) + 1;
            
            // Count languages
            const lang = talk.language || 'Unknown';
            languages[lang] = (languages[lang] || 0) + 1;
        });

        return {
            totalTalks,
            talkTypes,
            languages,
            avgTalkLength: this.getAverageTalkLength()
        };
    }

    // Get schedule analysis
    getScheduleAnalysis() {
        const scheduleData = {
            byDay: {},
            byTimeSlot: {},
            byRoom: {},
            parallelSessions: {}
        };

        this.talks.forEach(talk => {
            if (talk.times && talk.times.length > 0) {
                talk.times.forEach(time => {
                    const date = time.date;
                    const timeSlot = time.startTimeFormatted || time.startTime;
                    const room = time.room || 'Virtual/TBD';
                    const dayTimeKey = `${date}_${timeSlot}`;

                    // Count by day
                    scheduleData.byDay[date] = (scheduleData.byDay[date] || 0) + 1;
                    
                    // Count by time slot
                    scheduleData.byTimeSlot[timeSlot] = (scheduleData.byTimeSlot[timeSlot] || 0) + 1;
                    
                    // Count by room
                    scheduleData.byRoom[room] = (scheduleData.byRoom[room] || 0) + 1;
                    
                    // Count parallel sessions
                    scheduleData.parallelSessions[dayTimeKey] = (scheduleData.parallelSessions[dayTimeKey] || 0) + 1;
                });
            }
        });

        // Calculate average parallel sessions
        const parallelCounts = Object.values(scheduleData.parallelSessions);
        const avgParallel = parallelCounts.length > 0 ? 
            (parallelCounts.reduce((a, b) => a + b, 0) / parallelCounts.length).toFixed(1) : 0;

        return {
            ...scheduleData,
            avgParallelSessions: parseFloat(avgParallel),
            maxParallelSessions: Math.max(...parallelCounts, 0),
            totalTimeSlots: Object.keys(scheduleData.parallelSessions).length
        };
    }

    // Get speaker analysis
    getSpeakerAnalysis() {
        const speakers = {};
        const companies = {};
        const speakerTalkCounts = {};

        this.talks.forEach(talk => {
            if (talk.participants && talk.participants.length > 0) {
                talk.participants.forEach(participant => {
                    const speakerId = participant.speakerId || participant.fullName || 'Unknown';
                    const company = participant.companyName || participant.globalCompany || 'Unknown';
                    const fullName = participant.fullName || participant.globalFullName || speakerId;

                    // Count speakers
                    if (!speakers[speakerId]) {
                        speakers[speakerId] = {
                            name: fullName,
                            company: company,
                            jobTitle: participant.jobTitle || participant.globalJobtitle || '',
                            talkCount: 0,
                            talks: []
                        };
                    }
                    speakers[speakerId].talkCount++;
                    speakers[speakerId].talks.push({
                        title: talk.title,
                        code: talk.code,
                        type: talk.type
                    });

                    // Count companies
                    companies[company] = (companies[company] || 0) + 1;

                    // Track speaker talk counts for distribution
                    const currentCount = speakers[speakerId].talkCount;
                    speakerTalkCounts[currentCount] = (speakerTalkCounts[currentCount] || 0) + 1;
                });
            }
        });

        const totalSpeakers = Object.keys(speakers).length;
        const totalCompanies = Object.keys(companies).length;

        // Calculate speaker statistics
        const talkCounts = Object.values(speakers).map(s => s.talkCount);
        const avgTalksPerSpeaker = talkCounts.length > 0 ? 
            (talkCounts.reduce((a, b) => a + b, 0) / talkCounts.length).toFixed(1) : 0;

        return {
            totalSpeakers,
            totalCompanies,
            avgTalksPerSpeaker: parseFloat(avgTalksPerSpeaker),
            speakers: Object.values(speakers).sort((a, b) => b.talkCount - a.talkCount),
            companies: Object.entries(companies)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count),
            speakerTalkDistribution: speakerTalkCounts
        };
    }

    // Get topic analysis (word cloud data)
    getTopicAnalysis() {
        const words = {};
        const technologies = {};
        const commonWords = new Set([
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'under', 'over', 'through',
            'a', 'an', 'this', 'that', 'these', 'those', 'will', 'be', 'are', 'is', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'should', 'would', 'may', 'might', 'must',
            'how', 'what', 'when', 'where', 'why', 'who', 'which', 'your', 'our', 'their', 'its', 'his', 'her', 'my', 'we', 'you', 'they', 'it', 'he', 'she', 'i', 'me', 'us', 'them', 'him'
        ]);

        const techKeywords = [
            'ai', 'artificial intelligence', 'machine learning', 'ml', 'llm', 'generative', 'kubernetes', 'openshift', 'red hat', 'cloud', 'hybrid', 'docker', 'container', 'microservices',
            'api', 'rest', 'graphql', 'database', 'sql', 'nosql', 'mongodb', 'postgresql', 'automation', 'devops', 'cicd', 'pipeline', 'jenkins', 'ansible', 'terraform',
            'security', 'cybersecurity', 'encryption', 'authentication', 'oauth', 'jwt', 'blockchain', 'iot', 'edge', 'serverless', 'function', 'lambda', 'power', 'mainframe',
            'data', 'analytics', 'visualization', 'dashboard', 'monitoring', 'observability', 'performance', 'scaling', 'infrastructure', 'platform', 'saas', 'paas', 'iaas'
        ];

        // Process titles and abstracts
        this.talks.forEach(talk => {
            const text = `${talk.title || ''} ${this.cleanText(talk.abstract || '')}`.toLowerCase();
            const words_array = text.split(/\\s+|[.,;:!?()\\[\\]{}\"'-]/);
            
            words_array.forEach(word => {
                word = word.trim();
                if (word.length > 2 && !commonWords.has(word) && !/^\\d+$/.test(word)) {
                    words[word] = (words[word] || 0) + 1;
                    
                    // Check if it's a technology keyword
                    if (techKeywords.some(tech => word.includes(tech) || tech.includes(word))) {
                        technologies[word] = (technologies[word] || 0) + 1;
                    }
                }
            });
        });

        // Get top words for word cloud
        const topWords = Object.entries(words)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 100)
            .map(([word, count]) => ({ word, count }));

        const topTechnologies = Object.entries(technologies)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 50)
            .map(([tech, count]) => ({ tech, count }));

        return {
            topWords,
            topTechnologies,
            totalUniqueWords: Object.keys(words).length
        };
    }

    // Get average talk length
    getAverageTalkLength() {
        const lengths = this.talks
            .filter(talk => talk.length && !isNaN(talk.length))
            .map(talk => talk.length);
        
        return lengths.length > 0 ? 
            Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 60;
    }

    // Get room capacity analysis
    getRoomAnalysis() {
        const rooms = {};
        const capacities = [];

        this.talks.forEach(talk => {
            if (talk.times && talk.times.length > 0) {
                talk.times.forEach(time => {
                    const roomName = time.room || 'Virtual/TBD';
                    const capacity = parseInt(time.capacity) || 0;
                    
                    if (!rooms[roomName]) {
                        rooms[roomName] = {
                            name: roomName,
                            capacity: capacity,
                            sessionCount: 0,
                            totalSeats: 0
                        };
                    }
                    
                    rooms[roomName].sessionCount++;
                    if (capacity > 0) {
                        rooms[roomName].totalSeats += capacity;
                        capacities.push(capacity);
                    }
                });
            }
        });

        const avgCapacity = capacities.length > 0 ? 
            Math.round(capacities.reduce((a, b) => a + b, 0) / capacities.length) : 0;

        return {
            rooms: Object.values(rooms).sort((a, b) => b.sessionCount - a.sessionCount),
            avgRoomCapacity: avgCapacity,
            totalCapacity: capacities.reduce((a, b) => a + b, 0),
            totalRooms: Object.keys(rooms).length
        };
    }

    // Get comprehensive analytics
    getFullAnalysis() {
        return {
            basicStats: this.getBasicStats(),
            schedule: this.getScheduleAnalysis(),
            speakers: this.getSpeakerAnalysis(),
            topics: this.getTopicAnalysis(),
            rooms: this.getRoomAnalysis(),
            lastUpdated: new Date().toISOString()
        };
    }
}

module.exports = EventAnalyzer;
