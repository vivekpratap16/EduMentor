const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. Firebase Admin Setup
// Dhyaan dein: File ka naam wahi rakhein jo aapke folder mein hai
const serviceAccount = require("./serviceAccountKey.json"); 

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// 2. Gemini AI Setup
// Yahan apni API Key paste karein jo aapne Google AI Studio se li hai
const genAI = new GoogleGenerativeAI("AIzaSyDhi-HTxYHJ9wJu4nWhlIhpsVsOht4nQGc");

async function getUniversityData(uniName, website) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // AI ko instruction dena
    const prompt = `Research about ${uniName}. Official website: ${website}. 
    Find the following information:
    1. Average annual tuition fees for their top courses.
    2. Average placement package (Salary) for students.
    
    Return the result strictly in this JSON format:
    {
      "fees": "₹amount per year",
      "placement": "₹amount P.A."
    }
    If exact data is not found, provide a very close estimate based on general knowledge. Only output JSON.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Kabhi-kabhi AI extra text bhej deta hai, isliye JSON extract karna
        const jsonMatch = text.match(/\{.*\}/s);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Invalid JSON response from AI");
    } catch (error) {
        console.error(`❌ AI Error for ${uniName}:`, error.message);
        return { fees: "Consult Website", placement: "Check Official Site" };
    }
}

async function runSmartScraper() {
    console.log("-----------------------------------------");
    console.log("🚀 Starting SMART AI Scraper Bot...");
    console.log("-----------------------------------------");

    try {
        const snapshot = await db.collection("universities").get();

        if (snapshot.empty) {
            console.log("⚠️ Database khali hai! Pehle Admin page se data dalein.");
            return;
        }

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // Sirf "Pending" data ko update karein
            if (data.fees === "Pending" || data.placement === "Pending") {
                console.log(`\n🔍 Found Pending Data for: ${data.name}`);
                console.log(`🧠 AI is researching ${data.name} using ${data.website || 'internet'}...`);

                const aiResult = await getUniversityData(data.name, data.website);

                // Firestore mein update karein
                await db.collection("universities").doc(doc.id).update({
                    fees: aiResult.fees,
                    placement: aiResult.placement,
                    ai_verified: true,
                    lastUpdated: new Date().toISOString()
                });

                console.log(`✅ SUCCESS: Updated ${data.name}`);
                console.log(`   💰 Fees: ${aiResult.fees}`);
                console.log(`   💼 Placement: ${aiResult.placement}`);
            }
        }

        console.log("\n✨ Sabhi universities process ho gayi hain!");

    } catch (error) {
        console.error("❌ Fatal Error:", error);
    }
}

// Bot chalayein
runSmartScraper();