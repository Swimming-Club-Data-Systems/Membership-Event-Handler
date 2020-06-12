/**
 * Stripe helpers
 */

exports.getCardBrand = function (brand) {
  if (brand == 'visa') {
    return 'Visa';
  } else if (brand == 'mastercard') {
    return 'Mastercard';
  } else if (brand == 'amex') {
    return 'American Express';
  } else if (brand == 'diners') {
    return 'Diners Club';
  } else if (brand == 'discover') {
    return 'Discover';
  } else if (brand == 'jcb') {
    return 'JCB';
  } else if (brand == 'unionpay') {
    return 'UnionPay';
  } else {
    return 'Unknown Card';
  }
}

exports.getWalletName = function (name) {
  if (name == 'apple_pay') {
    return 'Apple Pay';
  } else if (name == 'amex_express_checkout') {
    return 'Amex Express Checkout';
  } else if (name == 'google_pay') {
    return 'Google Pay';
  } else if (name == 'masterpass') {
    return 'Masterpass  ';
  } else if (name == 'samsung_pay') {
    return 'Samsung Pay';
  } else if (name == 'visa_checkout') {
    return 'Visa Checkout';
  } else {
    return 'Other wallet';
  }
}