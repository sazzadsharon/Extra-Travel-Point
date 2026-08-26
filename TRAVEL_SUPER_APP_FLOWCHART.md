# Extra Travel Point — Travel Super App System Flowchart

Below is the complete end-to-end Mermaid flowchart representing the user journey, core modules, payment execution, QR digital pass verification, AI trip assistant, and Super Admin / Vendor operations for Extra Travel Point.

```mermaid
graph TD
    %% Client Layer & Entry Points
    User([📱 User / Traveler]) -->|Open Mobile App / Web| Choice{Action Choice}
    
    %% Flow 1: AI Assistant & Custom Trip
    Choice -->|Prompt AI Assistant| AI[🤖 AI Travel Agent]
    AI -->|Analyze Origin, Dest & Budget| AIPackage[Day-by-Day Itinerary & Budget Breakdown]
    AIPackage -->|One-Click Book| SeatSelect[💺 Interactive Seat Map & Room Picker]
    
    %% Flow 2: Direct Search & Booking
    Choice -->|Direct Search| Category[Bus / Launch / Flight / Hotel / Transport]
    Category --> SeatSelect
    
    %% Seat Lock & Holding
    SeatSelect -->|Hold Seats 10 Mins| Lock[🔒 Real-time 10-Min Seat Lock]
    Lock --> Discount{Combo / Promo Discount?}
    Discount -->|3+ Services or Hotel+Food| ComboApply[Apply 10%-15% Combo Discount]
    Discount -->|Promo Code| PromoApply[Apply Coupon Code]
    ComboApply --> PayGateway[💳 Payment Gateway Gateway]
    PromoApply --> PayGateway
    
    %% Payment & Verification Flow
    PayGateway -->|Select Channel| Gateways[bKash / Nagad / Rocket / SSLCommerz / Card]
    Gateways -->|Transaction Success| HMAC[🔐 Generate HMAC-SHA256 Encrypted QR Pass]
    Gateways -->|Transaction Failed| Retry[🔄 Payment Retry & Auto Release Seats]
    
    %% E-Ticket & Pass Issue
    HMAC --> Ticket[🎫 My Trips & E-Ticket PDF / Digital Pass]
    Ticket --> PushNotif[🔔 Multi-Channel Notification: App Push, SMS, WhatsApp]
    
    %% In-Trip & Live Operations
    Ticket --> InTrip{During Journey}
    InTrip -->|Scan at Counter| VendorScan[📷 Vendor Scanner App]
    VendorScan -->|Verify HMAC Signature| VendorConfirm[✅ Discount & Entry Verified]
    
    InTrip -->|Check GPS Location| LiveTracking[📍 Live Bus & Vehicle Tracking + ETA]
    InTrip -->|Emergency Need| SOS[🆘 Emergency SOS Broadcast to 999 & Contacts]
    
    %% Post-Trip Loyalty & Analytics
    VendorConfirm --> Loyalty[🎁 Earn ETP Reward Points & Cashback]
    Loyalty --> Review[⭐ Submit Review & Rating]
    Review --> Admin[👨💼 Super Admin Dashboard & Vendor Payout Settlement]
```

---

## System Sub-Flows Summary

### 1. User & AI Trip Planning Sub-Flow
1. User provides prompt: *"Dhaka to Kuakata, 3 Days, Budget 5000 BDT"*
2. AI calculates budget allocation (Transport 20%, Hotel 36%, Food 24%, Local 10%, Emergency 10%).
3. AI generates Day-1 to Day-3 itinerary with weather forecast.
4. User selects "One-Click Trip Booking".

### 2. Payment & QR Digital Ticket Sub-Flow
1. Payment initiated via bKash/Nagad/Rocket/SSLCommerz.
2. Webhook received with HMAC signature verification.
3. System issues HMAC-SHA256 signed QR ticket.
4. Vendor scans QR ticket using Vendor App scanner to verify validity and process payout.
