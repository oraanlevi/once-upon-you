import { useState } from 'react';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { formatMoney } from '../utils/pricing';

function CheckoutPaymentForm({
  shippingData,
  onCompletePaidOrder,
  cartSummary,
  displayTotalCents,
  isProcessingPayment,
  processingLabel,
  paymentError,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [localPaymentError, setLocalPaymentError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || isProcessingPayment) {
      return;
    }

    setLocalPaymentError('');

    const submitResult = await elements.submit();
    if (submitResult.error) {
      setLocalPaymentError(submitResult.error.message || 'Please review your payment details.');
      return;
    }

    const confirmation = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        payment_method_data: {
          billing_details: {
            name: [shippingData.firstName, shippingData.lastName].filter(Boolean).join(' ').trim(),
            email: shippingData.email || undefined,
            address: {
              line1: shippingData.address || undefined,
              city: shippingData.city || undefined,
              postal_code: shippingData.postalCode || undefined,
            },
          },
        },
      },
    });

    if (confirmation.error) {
      setLocalPaymentError(confirmation.error.message || 'Payment could not be confirmed.');
      return;
    }

    if (!confirmation.paymentIntent?.id || confirmation.paymentIntent.status !== 'succeeded') {
      setLocalPaymentError('Payment is still processing. Please try again in a moment.');
      return;
    }

    try {
      await onCompletePaidOrder(confirmation.paymentIntent.id);
    } catch {
      // Parent checkout state already surfaces the finalization error.
    }
  };

  return (
    <form className="checkout-form" onSubmit={handleSubmit}>
      {paymentError ? <p className="generation-error">{paymentError}</p> : null}
      {localPaymentError ? <p className="generation-error">{localPaymentError}</p> : null}

      <section className="payment-section" aria-labelledby="payment-heading">
        <div className="payment-section-head">
          <h3 id="payment-heading">Payment</h3>
          <p>
            Pay securely here with Stripe. Apple Pay, Google Pay, and saved wallet methods appear
            automatically when Stripe supports them on the customer&apos;s device.
          </p>
        </div>
        <div className="payment-element-shell">
          <PaymentElement
            options={{
              layout: 'tabs',
            }}
          />
        </div>
      </section>

      <div className="checkout-actions">
        <button
          type="submit"
          className="create-book-button payment-button"
          disabled={!stripe || !elements || isProcessingPayment}
        >
          {isProcessingPayment
            ? (processingLabel || 'Processing payment...')
            : `Pay ${formatMoney(displayTotalCents ?? cartSummary.totalCents)}`}
        </button>
      </div>
    </form>
  );
}

export default CheckoutPaymentForm;
