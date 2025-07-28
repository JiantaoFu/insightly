import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SERVER_URL } from "../components/Constants";
import { useCredits } from "../contexts/CreditsContext";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { refreshCredits } = useCredits();

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    console.log('[PaymentSuccess] session_id:', sessionId);
    if (!sessionId) {
      setStatus("error");
      setMessage("Missing session ID.");
      return;
    }
    fetch(`${SERVER_URL}/api/verify-session?session_id=${sessionId}`)
      .then(res => res.json())
      .then(async data => {
        console.log('[PaymentSuccess] verify-session response:', data);
        if (data.success) {
          setStatus("success");
          let notificationMsg = "";
          // Determine payment type for correct message using 'type' field
          if (data.type === "one-time") {
            notificationMsg = "Starter Pack already activated.";
          } else if (data.type === "subscription") {
            notificationMsg = "Subscription activated! You now have unlimited access.";
          } else if (data.type === "one-time") {
            notificationMsg = "Starter Pack activated! Credits added.";
          } else {
            notificationMsg = "Payment processed.";
          }
          setMessage("Payment successful! " + notificationMsg);
          toast.success(notificationMsg, { duration: 2000, id: 'payment-success' });
          // Refresh credits immediately
          if (refreshCredits) await refreshCredits();
          // Show message for 2s, then redirect
          setTimeout(() => {
            navigate("/app");
          }, 2000);
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed.");
          toast.error(data.error || "Verification failed.", { id: 'payment-error' });
        }
      })
      .catch((err) => {
        console.error('[PaymentSuccess] fetch error:', err);
        setStatus("error");
        setMessage("Verification failed.");
      });
  }, [searchParams, navigate, refreshCredits]);

  return (
    <>
      <Toaster position="top-center" />
      {status === "verifying" && <div>Verifying payment...</div>}
      {status === "success" && (
        <div>{message}<br /><span style={{fontSize:12}}>Redirecting to app...</span></div>
      )}
      {status === "error" && <div style={{ color: "red" }}>{message}</div>}
    </>
  );
};

export default PaymentSuccess;
