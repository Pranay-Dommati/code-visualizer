/**
 * LMS Context Data (Mock)
 * ========================
 * 
 * Simulates LMS course structure for V1.
 * Later replaced by real WordPress/LMS API.
 */

export const LMS_COURSES = {
    python: {
        name: "Python",
        sections: {
            basics: {
                name: "Basics",
                lessons: [
                    { id: "variables", name: "Variables", concepts: ["assignment", "naming"] },
                    { id: "data_types", name: "Data Types", concepts: ["int", "str", "list"] }
                ]
            },
            loops: {
                name: "Loops",
                lessons: [
                    { id: "for_loop", name: "For Loop", concepts: ["iteration", "range", "sequence"] },
                    { id: "while_loop", name: "While Loop", concepts: ["condition", "iteration"] }
                ]
            },
            conditions: {
                name: "Conditions",
                lessons: [
                    { id: "if_else", name: "If-Else", concepts: ["comparison", "branching"] }
                ]
            },
            functions: {
                name: "Functions",
                lessons: [
                    { id: "simple_functions", name: "Simple Functions", concepts: ["def", "return", "parameters"] }
                ]
            }
        }
    }
};

export const LANGUAGES = [
    { code: "en", name: "English" },
    { code: "te", name: "Telugu" }
];

/**
 * Get all available courses
 */
export function getCourses() {
    return Object.entries(LMS_COURSES).map(([id, course]) => ({
        id,
        name: course.name
    }));
}

/**
 * Get sections for a course
 */
export function getSections(courseId) {
    const course = LMS_COURSES[courseId];
    if (!course) return [];

    return Object.entries(course.sections).map(([id, section]) => ({
        id,
        name: section.name
    }));
}

/**
 * Get lessons for a section
 */
export function getLessons(courseId, sectionId) {
    const course = LMS_COURSES[courseId];
    if (!course) return [];

    const section = course.sections[sectionId];
    if (!section) return [];

    return section.lessons;
}
