"""
Validation package initialization.
"""
from backend.startup_validator.validation.scoring import calculate_validation_score
from backend.startup_validator.validation.strengths import generate_dynamic_strengths
from backend.startup_validator.validation.risks import generate_dynamic_risks

__all__ = [
    "calculate_validation_score",
    "generate_dynamic_strengths",
    "generate_dynamic_risks",
]
