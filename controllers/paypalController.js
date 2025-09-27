import Order from '../models/Order.js';
import { getPayPalClient, paypalSdk } from '../services/paypalClient.js';

// Helper to standardize server error responses while preserving internal diagnostics in logs
function respondServerError(res, context, err, fallbackMessage) {
  // Prefer a safe message (never leak secrets) while logging full detail server-side
  console.error(`[PayPal] ${context} ::`, err?.message, err?.response?.status || '', err?.response?.data || '', err?.stack);
  return res.status(500).json({ message: fallbackMessage });
}

// Create a PayPal order based on a local Order document
export const createPayPalOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ message: 'orderId is required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Validate numeric total
    if (typeof order.totalAmount !== 'number' || isNaN(order.totalAmount) || order.totalAmount <= 0) {
      return res.status(400).json({ message: 'Order total is invalid' });
    }

    // Only allow creating PayPal order for pending, unpaid orders
    if (order.paymentStatus === 'completed') {
      return res.status(400).json({ message: 'Order is already paid' });
    }

    let client;
    try {
      client = await getPayPalClient();
    } catch (err) {
      return respondServerError(res, 'getPayPalClient(create)', err, 'Payment gateway not configured');
    }

    const request = new paypalSdk.orders.OrdersCreateRequest();
    request.prefer('return=representation');

    const amount = {
      currency_code: order.currency || 'USD',
      value: (order.totalAmount).toFixed(2)
    };

    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: order._id.toString(),
          description: `Order ${order.orderNumber}`,
          amount
        }
      ]
    });

    let response;
    try {
      response = await client.execute(request);
    } catch (err) {
      return respondServerError(res, 'client.execute(createOrder)', err, 'Failed to create PayPal order');
    }

    // Save PayPal order id reference (ignore save errors separately)
    try {
      order.paymentMethod = 'paypal';
      order.paymentReference = response.result.id;
      await order.save();
    } catch (err) {
      console.error('[PayPal] Failed saving order after create', err);
    }

    res.json({ id: response.result.id, status: response.result.status, links: response.result.links });
  } catch (err) {
    return respondServerError(res, 'createPayPalOrder(unhandled)', err, 'Failed to create PayPal order');
  }
};

// Capture a PayPal order and mark local order paid
export const capturePayPalOrder = async (req, res) => {
  try {
    const { paypalOrderId } = req.body;
    if (!paypalOrderId) return res.status(400).json({ message: 'paypalOrderId is required' });

    let client;
    try {
      client = await getPayPalClient();
    } catch (err) {
      return respondServerError(res, 'getPayPalClient(capture)', err, 'Payment gateway not configured');
    }

    const request = new paypalSdk.orders.OrdersCaptureRequest(paypalOrderId);
    request.requestBody({});

    let capture;
    try {
      capture = await client.execute(request);
    } catch (err) {
      return respondServerError(res, 'client.execute(capture)', err, 'Failed to capture PayPal order');
    }

    const referenceId = capture?.result?.purchase_units?.[0]?.reference_id;
    const status = capture?.result?.status;

    if (!referenceId) {
      return res.status(400).json({ message: 'Missing reference id from PayPal capture' });
    }

    const order = await Order.findById(referenceId);
    if (!order) return res.status(404).json({ message: 'Local order not found' });

    if (status === 'COMPLETED') {
      order.paymentStatus = 'completed';
      order.status = order.status === 'pending' ? 'processing' : order.status;
      order.paymentDetails = capture.result;
      await order.save();
      return res.json({ message: 'Payment captured', orderId: order._id, status });
    }

    // Mark as failed if not completed
    order.paymentStatus = 'failed';
    order.paymentDetails = capture.result;
    await order.save();
    return res.status(400).json({ message: 'Payment not completed', status });
  } catch (err) {
    return respondServerError(res, 'capturePayPalOrder(unhandled)', err, 'Failed to capture PayPal order');
  }
};
