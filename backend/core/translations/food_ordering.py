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


STRINGS: dict[str, dict[Language, str]] = {
    FEATURE_ORDER_FOOD: {"en": "Order Food", "hi": "खाना ऑर्डर करें"},

    ASK_MENU_BROWSE: {
        "en": "Here's our menu — tap an item to add it to your cart.",
        "hi": "यह रहा हमारा मेन्यू — किसी आइटम को अपने कार्ट में जोड़ने के लिए टैप करें।",
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
        "en": "🛒 Your cart:\n{cart_lines}\nTotal: ₹{total_rupees}",
        "hi": "🛒 आपका कार्ट:\n{cart_lines}\nकुल: ₹{total_rupees}",
    },
    CART_EMPTY_LINE: {"en": "(empty)", "hi": "(खाली)"},
    ADD_ANOTHER_ITEM_BUTTON: {"en": "Add Item", "hi": "आइटम जोड़ें"},
    CHECKOUT_BUTTON: {"en": "Checkout", "hi": "चेकआउट"},
    CANCEL_ORDER_BUTTON: {"en": "Cancel Order", "hi": "ऑर्डर रद्द करें"},
    ORDER_CANCELLED_TEXT: {"en": "Your order has been cancelled.", "hi": "आपका ऑर्डर रद्द कर दिया गया है।"},

    ASK_FULFILLMENT_TYPE: {
        "en": "Would you like this for pickup or delivery?",
        "hi": "क्या आप इसे पिकअप या डिलीवरी के लिए चाहेंगे?",
    },
    PICKUP_BUTTON: {"en": "Pickup", "hi": "पिकअप"},
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
        "en": "Order {reference_id} — total ₹{total_rupees}.\nPay here to confirm your order: {payment_link_url}",
        "hi": "ऑर्डर {reference_id} — कुल ₹{total_rupees}।\nअपना ऑर्डर पक्का करने के लिए यहाँ भुगतान करें: {payment_link_url}",
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
        "en": "✅ Payment received! Order {reference_id} is confirmed.\n{fulfillment_line}Total: ₹{total_rupees}\nThank you!",
        "hi": "✅ भुगतान प्राप्त हुआ! ऑर्डर {reference_id} पक्का हो गया है।\n{fulfillment_line}कुल: ₹{total_rupees}\nधन्यवाद!",
    },
}
