"""
LMS Context Module
==================

Hardcoded lesson map for V1.
Later replaced by real LMS/WordPress API.
"""

from typing import Dict, List, Any

# Hardcoded LMS context map
LMS_CONTEXT = {
    "python": {
        "name": "Python",
        "sections": {
            "basics": {
                "name": "Basics",
                "lessons": {
                    "variables": {
                        "name": "Variables",
                        "concepts": ["assignment", "naming", "types"],
                        "common_confusion": "Students often confuse = (assignment) with == (comparison)"
                    },
                    "data_types": {
                        "name": "Data Types",
                        "concepts": ["int", "str", "list", "float"],
                        "common_confusion": "Understanding when to use lists vs individual variables"
                    }
                }
            },
            "loops": {
                "name": "Loops",
                "lessons": {
                    "for_loop": {
                        "name": "For Loop",
                        "concepts": ["iteration", "range", "sequence", "loop_variable"],
                        "common_confusion": "How range() works and why it excludes the end value"
                    },
                    "while_loop": {
                        "name": "While Loop",
                        "concepts": ["condition", "iteration", "infinite_loop"],
                        "common_confusion": "When to use while vs for loop"
                    }
                }
            },
            "conditions": {
                "name": "Conditions",
                "lessons": {
                    "if_else": {
                        "name": "If-Else",
                        "concepts": ["comparison", "branching", "boolean"],
                        "common_confusion": "Understanding elif vs nested if statements"
                    }
                }
            },
            "functions": {
                "name": "Functions",
                "lessons": {
                    "simple_functions": {
                        "name": "Simple Functions",
                        "concepts": ["def", "return", "parameters", "arguments"],
                        "common_confusion": "Difference between parameters and arguments"
                    }
                }
            }
        }
    }
}


def get_courses() -> List[Dict[str, str]]:
    """Get list of available courses."""
    return [
        {"id": course_id, "name": course_data["name"]}
        for course_id, course_data in LMS_CONTEXT.items()
    ]


def get_sections(course_id: str) -> List[Dict[str, str]]:
    """Get sections for a course."""
    course = LMS_CONTEXT.get(course_id)
    if not course:
        return []
    
    return [
        {"id": section_id, "name": section_data["name"]}
        for section_id, section_data in course["sections"].items()
    ]


def get_lessons(course_id: str, section_id: str) -> List[Dict[str, str]]:
    """Get lessons for a section."""
    course = LMS_CONTEXT.get(course_id)
    if not course:
        return []
    
    section = course["sections"].get(section_id)
    if not section:
        return []
    
    return [
        {"id": lesson_id, "name": lesson_data["name"]}
        for lesson_id, lesson_data in section["lessons"].items()
    ]


def get_lesson_context(course_id: str, section_id: str, lesson_id: str) -> Dict[str, Any]:
    """Get full context for a lesson."""
    course = LMS_CONTEXT.get(course_id)
    if not course:
        return None
    
    section = course["sections"].get(section_id)
    if not section:
        return None
    
    lesson = section["lessons"].get(lesson_id)
    if not lesson:
        return None
    
    return {
        "course": course["name"],
        "section": section["name"],
        "lesson": lesson["name"],
        "concepts": lesson.get("concepts", []),
        "common_confusion": lesson.get("common_confusion", "")
    }
