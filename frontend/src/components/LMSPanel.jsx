/**
 * LMS Panel Component
 * ===================
 * 
 * Simple dropdown-based LMS simulation for V1.
 * Replaces code editor as the entry point.
 */

import React, { useState, useEffect } from 'react';
import { getCourses, getSections, getLessons, LANGUAGES } from '../data/lms_data';

const LMSPanel = ({ onAskTeacher, isLoading }) => {
    // Selection state
    const [course, setCourse] = useState('python');
    const [section, setSection] = useState('');
    const [lesson, setLesson] = useState('');
    const [language, setLanguage] = useState('en');
    const [question, setQuestion] = useState('');

    // Derived data
    const [sections, setSections] = useState([]);
    const [lessons, setLessons] = useState([]);

    // Update sections when course changes
    useEffect(() => {
        const sectionList = getSections(course);
        setSections(sectionList);
        setSection(sectionList[0]?.id || '');
        setLesson('');
    }, [course]);

    // Update lessons when section changes
    useEffect(() => {
        if (section) {
            const lessonList = getLessons(course, section);
            setLessons(lessonList);
            setLesson(lessonList[0]?.id || '');
        } else {
            setLessons([]);
            setLesson('');
        }
    }, [course, section]);

    const handleAskTeacher = () => {
        if (!lesson) return;

        onAskTeacher({
            course,
            section,
            lesson,
            language,
            user_question: question || "Explain this concept to me"
        });
    };

    const courses = getCourses();

    return (
        <div className="lms-panel">
            <div className="lms-header">
                <h2>🎓 EasyLearnova AI Teacher</h2>
                <p>Select a lesson and let AI teach you</p>
            </div>

            <div className="lms-selectors">
                {/* Course Selector */}
                <div className="selector-group">
                    <label>Course</label>
                    <select
                        value={course}
                        onChange={(e) => setCourse(e.target.value)}
                        disabled={isLoading}
                    >
                        {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Section Selector */}
                <div className="selector-group">
                    <label>Section</label>
                    <select
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        disabled={isLoading || sections.length === 0}
                    >
                        {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>

                {/* Lesson Selector */}
                <div className="selector-group">
                    <label>Lesson</label>
                    <select
                        value={lesson}
                        onChange={(e) => setLesson(e.target.value)}
                        disabled={isLoading || lessons.length === 0}
                    >
                        {lessons.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                    </select>
                </div>

                {/* Language Selector */}
                <div className="selector-group">
                    <label>Language</label>
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        disabled={isLoading}
                    >
                        {LANGUAGES.map(l => (
                            <option key={l.code} value={l.code}>{l.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Optional Question */}
            <div className="question-input">
                <label>Your question (optional)</label>
                <input
                    type="text"
                    placeholder="e.g., I don't understand how the loop variable changes"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={isLoading}
                />
            </div>

            {/* Ask Button */}
            <button
                className="ask-teacher-btn"
                onClick={handleAskTeacher}
                disabled={isLoading || !lesson}
            >
                {isLoading ? (
                    <>
                        <span className="spinner"></span>
                        AI is preparing...
                    </>
                ) : (
                    <>
                        🎤 Ask AI Teacher
                    </>
                )}
            </button>
        </div>
    );
};

export default LMSPanel;
