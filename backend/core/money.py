# core/money.py
"""Guest-facing price text. Prices are stored in paise; a whole-rupee price
reads "₹249" and anything else keeps its paise ("₹49.50"). Never truncate with
`// 100` -- the guest must be shown exactly what they will be charged."""


def format_price(paise: int) -> str:
    rupees, remainder = divmod(int(paise), 100)
    return f"₹{rupees}" if remainder == 0 else f"₹{rupees}.{remainder:02d}"
