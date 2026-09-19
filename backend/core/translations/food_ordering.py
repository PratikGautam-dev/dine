# core/translations/food_ordering.py
"""Food ordering plan, Sub-stage 3 of 4: menu browse, cart, pickup/delivery,
name collection, and payment-link send. A new top-level feature
(flows/patient_identity/menu.py's _FEATURE_MENU, key "order_food"), not a
booking TypeFlow -- see flows/food_ordering/__init__.py's own docstring."""
from core.translations._common import Language

FEATURE_ORDER_FOOD = "feature_order_food"

ASK_MENU_BROWSE = "ask_menu_browse"
VIEW_MENU_BUTTON = "view_menu_button"
MENU_SECTION_TITLE = "menu_section_title"
NO_MENU_ITEMS_AVAILABLE = "no_menu_items_available"
ITEM_ADDED_TO_CART = "item_added_to_cart"

CART_SUMMARY = "cart_summary"
CART_EMPTY_LINE = "cart_empty_line"
ADD_ANOTHER_ITEM_BUTTON = "add_another_item_button"
CHECKOUT_BUTTON = "checkout_button"
CANCEL_ORDER_BUTTON = "cancel_order_button"
ORDER_CANCELLED_TEXT = "order_cancelled_text"

ASK_FULFILLMENT_TYPE = "ask_fulfillment_type"
PICKUP_BUTTON = "pickup_button"
DELIVERY_BUTTON = "delivery_button"

ASK_DELIVERY_ADDRESS = "ask_delivery_address"
INVALID_DELIVERY_ADDRESS = "invalid_delivery_address"

ASK_CUSTOMER_NAME = "ask_customer_name_food"
INVALID_CUSTOMER_NAME = "invalid_customer_name_food"

ORDER_ITEM_UNAVAILABLE = "order_item_unavailable"
PAYMENT_LINK_MESSAGE = "payment_link_message"
PAYMENT_NOT_CONFIGURED = "payment_not_configured"
AWAITING_PAYMENT_REMINDER = "awaiting_payment_reminder"
ORDER_CONFIRMED_TEXT = "order_confirmed_text"

# Category-first browse, item card, cart editing, order review, pay-at-restaurant.
ASK_MENU_CATEGORY = "ask_menu_category"
CATEGORY_ITEM_COUNT = "category_item_count"
OTHER_CATEGORY = "other_category"
ASK_ITEMS_IN_CATEGORY = "ask_items_in_category"
MORE_ITEMS_ROW = "more_items_row"
MORE_ITEMS_ROW_DESC = "more_items_row_desc"
ADD_TO_CART_BUTTON = "add_to_cart_button"
ITEM_NO_LONGER_AVAILABLE = "item_no_longer_available"
CART_FULL = "cart_full"
EDIT_CART_BUTTON = "edit_cart_button"
ASK_EDIT_CART = "ask_edit_cart"
EDIT_CART_ROW_DESC = "edit_cart_row_desc"
EDIT_CART_ITEMS_SECTION = "edit_cart_items_section"
EDIT_CART_OTHER_SECTION = "edit_cart_other_section"
ITEM_REMOVED_FROM_CART = "item_removed_from_cart"
CART_NOW_EMPTY = "cart_now_empty"

ORDER_REVIEW_HEADING = "order_review_heading"
SUBTOTAL_LABEL = "subtotal_label"
DELIVERY_FEE_LABEL = "delivery_fee_label"
TOTAL_LABEL = "total_label"
REVIEW_TAKEAWAY_LINE = "review_takeaway_line"
REVIEW_DELIVERY_LINE = "review_delivery_line"
REVIEW_NAME_LINE = "review_name_line"
PAY_NOTE_TAKEAWAY = "pay_note_takeaway"
PAY_NOTE_DELIVERY = "pay_note_delivery"
CONFIRM_ORDER_BUTTON = "confirm_order_button"
PAY_AT_RESTAURANT_BUTTON = "pay_at_restaurant_button"
PAY_ON_DELIVERY_BUTTON = "pay_on_delivery_button"
PAY_ONLINE_BUTTON = "pay_online_button"
ORDER_PLACED_TEXT = "order_placed_text"


STRINGS: dict[str, dict[Language, str]] = {
    FEATURE_ORDER_FOOD: {"en": "Order Food", "hi": "खाना ऑर्डर करें"},

    ASK_MENU_BROWSE: {
        "en": "Tap an item to add it to your cart.",
        "hi": "किसी आइटम को अपने कार्ट में जोड़ने के लिए टैप करें।",
    },
    VIEW_MENU_BUTTON: {"en": "View Menu", "hi": "मेन्यू देखें"},
    MENU_SECTION_TITLE: {"en": "Menu", "hi": "मेन्यू"},
    NO_MENU_ITEMS_AVAILABLE: {
        "en": "Sorry, nothing is available to order right now. Please check back later.",
        "hi": "क्षमा करें, अभी ऑर्डर के लिए कुछ भी उपलब्ध नहीं है। कृपया बाद में देखें।",
    },
    ITEM_ADDED_TO_CART: {
        "en": "{item_name} added to your cart.",
        "hi": "{item_name} आपके कार्ट में जोड़ दिया गया है।",
    },

    CART_SUMMARY: {
        "en": "🛒 Your cart:\n{cart_lines}\nTotal: {total}",
        "hi": "🛒 आपका कार्ट:\n{cart_lines}\nकुल: {total}",
    },
    CART_EMPTY_LINE: {"en": "(empty)", "hi": "(खाली)"},
    ADD_ANOTHER_ITEM_BUTTON: {"en": "Add Item", "hi": "आइटम जोड़ें"},
    CHECKOUT_BUTTON: {"en": "Checkout", "hi": "चेकआउट"},
    CANCEL_ORDER_BUTTON: {"en": "Cancel Order", "hi": "ऑर्डर रद्द करें"},
    ORDER_CANCELLED_TEXT: {"en": "Your order has been cancelled.", "hi": "आपका ऑर्डर रद्द कर दिया गया है।"},

    ASK_FULFILLMENT_TYPE: {
        "en": "Would you like this for takeaway or delivery?",
        "hi": "क्या आप इसे टेकअवे या डिलीवरी के लिए चाहेंगे?",
    },
    PICKUP_BUTTON: {"en": "Takeaway", "hi": "टेकअवे"},
    DELIVERY_BUTTON: {"en": "Delivery", "hi": "डिलीवरी"},

    ASK_DELIVERY_ADDRESS: {
        "en": "Please share your delivery address.",
        "hi": "कृपया अपना डिलीवरी पता साझा करें।",
    },
    INVALID_DELIVERY_ADDRESS: {
        "en": "Please enter a valid address.",
        "hi": "कृपया एक मान्य पता दर्ज करें।",
    },

    ASK_CUSTOMER_NAME: {
        "en": "What name should we put on the order?",
        "hi": "ऑर्डर पर हम कौन सा नाम लिखें?",
    },
    INVALID_CUSTOMER_NAME: {
        "en": "Please enter a valid name.",
        "hi": "कृपया एक मान्य नाम दर्ज करें।",
    },

    ORDER_ITEM_UNAVAILABLE: {
        "en": "Sorry, one item in your cart is no longer available: {reason}. Please update your cart.",
        "hi": "क्षमा करें, आपके कार्ट में एक आइटम अब उपलब्ध नहीं है: {reason}। कृपया अपना कार्ट अपडेट करें।",
    },
    PAYMENT_LINK_MESSAGE: {
        "en": "Order {reference_id} — total {total}.\nPay here to confirm your order: {payment_link_url}",
        "hi": "ऑर्डर {reference_id} — कुल {total}।\nअपना ऑर्डर पक्का करने के लिए यहाँ भुगतान करें: {payment_link_url}",
    },
    PAYMENT_NOT_CONFIGURED: {
        "en": "Sorry, online ordering isn't available right now. Please try again later.",
        "hi": "क्षमा करें, अभी ऑनलाइन ऑर्डर उपलब्ध नहीं है। कृपया बाद में पुनः प्रयास करें।",
    },
    AWAITING_PAYMENT_REMINDER: {
        "en": "We're still waiting for your payment for order {reference_id}. Please use the payment link sent above.",
        "hi": "हम अभी भी ऑर्डर {reference_id} के लिए आपके भुगतान का इंतज़ार कर रहे हैं। कृपया ऊपर भेजे गए भुगतान लिंक का उपयोग करें।",
    },
    ORDER_CONFIRMED_TEXT: {
        "en": "✅ Payment received! Order {reference_id} is confirmed.\n{fulfillment_line}Total: {total}\nThank you!",
        "hi": "✅ भुगतान प्राप्त हुआ! ऑर्डर {reference_id} पक्का हो गया है।\n{fulfillment_line}कुल: {total}\nधन्यवाद!",
    },

    ASK_MENU_CATEGORY: {
        "en": "What would you like to order? Pick a category.",
        "hi": "आप क्या ऑर्डर करना चाहेंगे? एक श्रेणी चुनें।",
    },
    CATEGORY_ITEM_COUNT: {"en": "{count} items", "hi": "{count} आइटम"},
    OTHER_CATEGORY: {"en": "Other", "hi": "अन्य"},
    ASK_ITEMS_IN_CATEGORY: {
        "en": "{category} — tap an item to add it to your cart.",
        "hi": "{category} — किसी आइटम को अपने कार्ट में जोड़ने के लिए टैप करें।",
    },
    MORE_ITEMS_ROW: {"en": "More ›", "hi": "और देखें ›"},
    MORE_ITEMS_ROW_DESC: {"en": "See the next items", "hi": "अगले आइटम देखें"},
    ADD_TO_CART_BUTTON: {"en": "Add to cart", "hi": "कार्ट में जोड़ें"},
    ITEM_NO_LONGER_AVAILABLE: {
        "en": "Sorry, {item_name} is no longer available.",
        "hi": "क्षमा करें, {item_name} अब उपलब्ध नहीं है।",
    },
    CART_FULL: {
        "en": "Your cart already has {max_lines} different items. Remove one in Edit Cart before adding another.",
        "hi": "आपके कार्ट में पहले से {max_lines} अलग-अलग आइटम हैं। दूसरा जोड़ने से पहले Edit Cart में एक हटाएँ।",
    },
    EDIT_CART_BUTTON: {"en": "Edit Cart", "hi": "कार्ट बदलें"},
    ASK_EDIT_CART: {
        "en": "Tap an item to remove one of it, or cancel the whole order.",
        "hi": "किसी आइटम को टैप करके उसका एक हटाएँ, या पूरा ऑर्डर रद्द करें।",
    },
    EDIT_CART_ROW_DESC: {
        "en": "{quantity} × {unit_price} = {line_total} · tap to remove one",
        "hi": "{quantity} × {unit_price} = {line_total} · एक हटाने के लिए टैप करें",
    },
    EDIT_CART_ITEMS_SECTION: {"en": "Your items", "hi": "आपके आइटम"},
    EDIT_CART_OTHER_SECTION: {"en": "Other", "hi": "अन्य"},
    ITEM_REMOVED_FROM_CART: {
        "en": "Removed one {item_name} from your cart.",
        "hi": "आपके कार्ट से एक {item_name} हटा दिया गया।",
    },
    CART_NOW_EMPTY: {"en": "Your cart is now empty.", "hi": "आपका कार्ट अब खाली है।"},

    ORDER_REVIEW_HEADING: {"en": "🧾 Please review your order", "hi": "🧾 कृपया अपना ऑर्डर देख लें"},
    SUBTOTAL_LABEL: {"en": "Subtotal", "hi": "उप-योग"},
    DELIVERY_FEE_LABEL: {"en": "Delivery fee", "hi": "डिलीवरी शुल्क"},
    TOTAL_LABEL: {"en": "Total", "hi": "कुल"},
    REVIEW_TAKEAWAY_LINE: {"en": "🥡 Takeaway", "hi": "🥡 टेकअवे"},
    REVIEW_DELIVERY_LINE: {"en": "🛵 Delivery to: {address}", "hi": "🛵 डिलीवरी का पता: {address}"},
    REVIEW_NAME_LINE: {"en": "Name: {name}", "hi": "नाम: {name}"},
    PAY_NOTE_TAKEAWAY: {
        "en": "💵 You'll pay at the restaurant when you collect your order.",
        "hi": "💵 आप ऑर्डर लेते समय रेस्टोरेंट में भुगतान करेंगे।",
    },
    PAY_NOTE_DELIVERY: {
        "en": "💵 You'll pay when your order is delivered.",
        "hi": "💵 आप ऑर्डर की डिलीवरी होने पर भुगतान करेंगे।",
    },
    CONFIRM_ORDER_BUTTON: {"en": "Confirm Order", "hi": "ऑर्डर पक्का करें"},
    PAY_AT_RESTAURANT_BUTTON: {"en": "Pay at restaurant", "hi": "रेस्टोरेंट में भुगतान"},
    PAY_ON_DELIVERY_BUTTON: {"en": "Pay on delivery", "hi": "डिलीवरी पर भुगतान"},
    PAY_ONLINE_BUTTON: {"en": "Pay online", "hi": "ऑनलाइन भुगतान"},
    ORDER_PLACED_TEXT: {
        "en": "✅ Order {reference_id} placed!\n{fulfillment_line}{items_lines}\nTotal: {total}\n{payment_note}\nThe restaurant will confirm it shortly. Thank you!",
        "hi": "✅ ऑर्डर {reference_id} दे दिया गया!\n{fulfillment_line}{items_lines}\nकुल: {total}\n{payment_note}\nरेस्टोरेंट जल्द ही इसकी पुष्टि करेगा। धन्यवाद!",
    },
}
