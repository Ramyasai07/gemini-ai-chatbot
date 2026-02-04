from spellchecker import SpellChecker
import logging

logger = logging.getLogger(__name__)


class SpellService:
    """Simple spell correction service using pyspellchecker.
    Provides best-guess correction and suggestions.
    """

    def __init__(self, language: str = 'en'):
        self.spell = SpellChecker(language=language)
        logger.info("✓ SpellService initialized")

    def correct_text(self, text: str) -> tuple[str, list]:
        """Return corrected text and list of suggested corrections.

        Args:
            text: input string

        Returns:
            (corrected_text, suggestions)
        """
        if not text:
            return text, []

        words = text.split()
        misspelled = self.spell.unknown(words)
        suggestions = []
        corrected_words = []

        for w in words:
            if w in misspelled:
                corr = self.spell.correction(w) or w
                suggestions.append((w, corr))
                corrected_words.append(corr)
            else:
                corrected_words.append(w)

        corrected = ' '.join(corrected_words)
        return corrected, suggestions
