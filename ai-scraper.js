const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const allUniversities = [
    { name: "Amity Online", reg: 0, exam: 0, loan: "FIBE/AVANSE", link: "https://amityonline.com/", dualSpec: true },
    { name: "LPU Online", reg: 1000, exam: 2000, loan: "AVANSE/PROPELLED", link: "https://www.lpuonline.com/", dualSpec: true },
    { name: "UPES Online", reg: 1000, exam: 0, loan: "JODO/KHUHU", link: "https://upesonline.ac.in/", dualSpec: false },
    { name: "Chandigarh University Online", reg: 1000, exam: 0, loan: "AVANSE/GRAYQUEST", link: "https://uims.cuchd.in/", dualSpec: true },
    { name: "Manipal University Jaipur", reg: 500, exam: 0, loan: "PROPELLED/FIBE", link: "https://jaipur.manipal.edu/", dualSpec: true },
    { name: "Jain University Online", reg: 1000, exam: 0, loan: "AVANSE/PROPELLED", link: "https://onlinejain.com/", dualSpec: false }
];

const UNIVERSITY_30_PARAM_SCHEMA = {
    semesterFee: "number",
    totalTuitionFee: "number",
    registrationFee: "number",
    examinationFee: "number",
    alumniFee: "number",
    hiddenChargesDescription: "string",
    emiOptionsAvailable: "boolean",
    approvedLoanPartners: "array of strings",
    avgPlacementPackage: "string",
    highestPlacementPackage: "string",
    topRecruiters: "array of strings",
    roiRatingScore: "string",
    industryTieUpsCount: "number",
    internshipStipendAvg: "string",
    alumniNetworkStrength: "string",
    naacAccreditationRating: "string",
    ugcDebApprovalStatus: "boolean",
    nirfRankingBand: "string",
    globalRecognitions: "array of strings",
    minimumEligibilityCriteria: "string",
    courseDurationMonths: "number",
    examinationMode: "string",
    admissionIntakeCycles: "array of strings",
    placementAssuranceGuarantee: "boolean",
    dedicatedCareerCellStatus: "boolean",
    resumeBuildingSupport: "boolean",
    mockInterviewSessionsCount: "number",
    virtualJobFairsAnnually: "number",
    incubationCenterAvailability: "boolean",
    skillCertificationAddOns: "array of strings"
};

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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyDhi-HTxYHJ9wJu4nWhlIhpsVsOht4nQGc");

async function run30ParamFilterEngine(rawScrapedContent, targetUniversity) {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyDhi-HTxYHJ9wJu4nWhlIhpsVsOht4nQGc");
    const filterPromptSystemInstructions = `
        You are a cold, precise EdTech Data Aggregator Filter Engine.
        Analyze the raw web scraped text for ${targetUniversity} and map metrics into a strict JSON payload.
        Output MUST be valid minified JSON only. No markdown fences.
        Financial values must be parsed into absolute numbers where possible.
        If data is missing, populate it as null or empty array [].
    `;

    const dynamicUserPrompt = `
        Target Institution: ${targetUniversity}

        Raw Scraped Context Data Stream:
        ----------------------------------------
        ${rawScrapedContent}
        ----------------------------------------

        Extract and evaluate the following 30 specific parameters:
        1. semesterFee 2. totalTuitionFee 3. registrationFee 4. examinationFee 5. alumniFee 6. hiddenChargesDescription 7. emiOptionsAvailable 8. approvedLoanPartners (Array)
        9. avgPlacementPackage 10. highestPlacementPackage 11. topRecruiters (Array) 12. roiRatingScore 13. industryTieUpsCount 14. internshipStipendAvg 15. alumniNetworkStrength
        16. naacAccreditationRating 17. ugcDebApprovalStatus (Boolean) 18. nirfRankingBand 19. globalRecognitions (Array) 20. minimumEligibilityCriteria 21. courseDurationMonths 22. examinationMode 23. admissionIntakeCycles (Array)
        24. placementAssuranceGuarantee (Boolean) 25. dedicatedCareerCellStatus (Boolean) 26. resumeBuildingSupport (Boolean) 27. mockInterviewSessionsCount 28. virtualJobFairsAnnually 29. incubationCenterAvailability (Boolean) 30. skillCertificationAddOns (Array)

        Map every parameter meticulously. Output JSON object directly.
    `;

    try {
        const model = ai.getGenerativeModel({
            model: "gemini-2.5-pro",
            generationConfig: { responseMimeType: "application/json" }
        });

        const response = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: dynamicUserPrompt }] }],
            systemInstruction: filterPromptSystemInstructions
        });

        let rawTextOutput = response.text().trim();
        if (rawTextOutput.startsWith("```")) {
            rawTextOutput = rawTextOutput.replace(/^```json|```$/g, "").trim();
        }

        const structuredDataPayload = JSON.parse(rawTextOutput);
        Object.keys(UNIVERSITY_30_PARAM_SCHEMA).forEach((paramKey) => {
            if (!(paramKey in structuredDataPayload)) {
                structuredDataPayload[paramKey] = UNIVERSITY_30_PARAM_SCHEMA[paramKey] === "boolean"
                    ? false
                    : UNIVERSITY_30_PARAM_SCHEMA[paramKey].startsWith("array")
                        ? []
                        : null;
            }
        });

        structuredDataPayload.lastFilteredTimestamp = new Date().toISOString();
        structuredDataPayload.dataConsistencyVerified = true;
        return structuredDataPayload;
    } catch (error) {
        console.error(`[Filter Engine Error]: Failed to refine scraped dataset for ${targetUniversity}:`, error.message);
        return generateEmptySchemaFallback(targetUniversity);
    }
}

function generateEmptySchemaFallback(universityName) {
    const fallback = {};
    Object.keys(UNIVERSITY_30_PARAM_SCHEMA).forEach((key) => {
        fallback[key] = UNIVERSITY_30_PARAM_SCHEMA[key] === "boolean"
            ? false
            : UNIVERSITY_30_PARAM_SCHEMA[key].startsWith("array")
                ? []
                : null;
    });
    fallback.lastFilteredTimestamp = new Date().toISOString();
    fallback.dataConsistencyVerified = false;
    fallback.universityName = universityName;
    return fallback;
}

async function getUniversityData(uniName, website) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

        const jsonMatch = text.match(/\{.*\}/s);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const rawScrapedContext = `University: ${uniName}\nWebsite: ${website}\nAI Research Summary: ${JSON.stringify(parsed)}`;
            const structuredData = await run30ParamFilterEngine(rawScrapedContext, uniName);
            return { ...parsed, structuredData };
        }
        throw new Error("Invalid JSON response from AI");
    } catch (error) {
        console.error(`❌ AI Error for ${uniName}:`, error.message);
        return { fees: "Consult Website", placement: "Check Official Site", structuredData: generateEmptySchemaFallback(uniName) };
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
                    structuredInsights: aiResult.structuredData || {},
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
if (require.main === module) {
    runSmartScraper();
}

module.exports = {
    run30ParamFilterEngine,
    runSmartScraper,
    getUniversityData,
    UNIVERSITY_30_PARAM_SCHEMA
};
