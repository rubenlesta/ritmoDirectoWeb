import unittest
import re

class MusicService:
    @staticmethod
    def clean_filename(text):
        # Remove content in parentheses
        text = re.sub(r'\([^)]*\)', '', text)
        # Remove content in brackets
        text = re.sub(r'\[[^]]*\]', '', text)
        
        # Remove 'ft.' or 'feat.' and everything after (case insensitive)
        text = re.sub(r'\s+(ft\.?|feat\.?|featuring).*$', '', text, flags=re.IGNORECASE)
        
        # Remove extra spaces
        text = " ".join(text.split())
        return text

class TestCleaner(unittest.TestCase):
    def test_clean(self):
        cases = [
            ("Artist - Song (Official Video)", "Artist - Song"),
            ("Artist - Song [HQ]", "Artist - Song"),
            ("Artist - Song ft. Rapper", "Artist - Song"),
            ("Artist - Song feat. Rapper", "Artist - Song"),
            ("Artist - Song featuring Rapper", "Artist - Song"),
            ("Artist - Song ft. Rapper & Other", "Artist - Song"),
            ("Artist - Song (ft. Rapper)", "Artist - Song"), # Parentheses removal handles this first usually, but let's see
            ("Artist - Song", "Artist - Song"),
        ]
        
        for inp, expected in cases:
            with self.subTest(inp=inp):
                self.assertEqual(MusicService.clean_filename(inp), expected)

if __name__ == '__main__':
    unittest.main()
