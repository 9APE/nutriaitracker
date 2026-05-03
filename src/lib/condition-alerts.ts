export interface ConditionAlert {
  nutrient: string;
  label: string;
  direction: "min" | "max";
  dailyTargetMg: number;
  alertBelowPct: number;
  unit: string;
  amberTip: string;
  greenTip: string;
  sources: string[];
}

export const CONDITION_NUTRIENT_MAP: Record<string, ConditionAlert[]> = {
  "Celiac Disease": [
    { nutrient: "iron",      label: "Iron",             direction: "min", dailyTargetMg: 18,     alertBelowPct: 80,  unit: "mg",  amberTip: "Pair plant iron sources with vitamin C. Avoid tea/coffee with meals.",                                                                       greenTip: "Iron target met — energy and red blood cell production supported.",       sources: ["https://pubmed.ncbi.nlm.nih.gov/15825126/"] },
    { nutrient: "b12",       label: "Vitamin B12",      direction: "min", dailyTargetMg: 2.4,    alertBelowPct: 80,  unit: "mcg", amberTip: "B12 malabsorption common in Celiac. Consider supplement.",                                                                                  greenTip: "B12 sufficient — nerve function protected.",                              sources: ["https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/"] },
    { nutrient: "calcium",   label: "Calcium",          direction: "min", dailyTargetMg: 1000,   alertBelowPct: 80,  unit: "mg",  amberTip: "Villous atrophy reduces calcium absorption. Aim for fortified GF oat milk + leafy greens.",                                                  greenTip: "Calcium on track — bone density protected.",                              sources: ["https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/"] },
    { nutrient: "vitamin_d", label: "Vitamin D",        direction: "min", dailyTargetMg: 20,     alertBelowPct: 80,  unit: "mcg", amberTip: "Villous atrophy impairs fat-soluble vitamin absorption. Supplement 20 mcg (800 IU) daily.",                                                  greenTip: "Vitamin D on track — calcium absorption supported.",                      sources: ["https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/"] },
    { nutrient: "zinc",      label: "Zinc",             direction: "min", dailyTargetMg: 11,     alertBelowPct: 80,  unit: "mg",  amberTip: "Zinc malabsorption common in Celiac. Pumpkin seeds, chickpeas, cashews.",                                                                   greenTip: "Zinc sufficient — immune function supported.",                            sources: ["https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/"] },
    { nutrient: "folate",    label: "Folic Acid",       direction: "min", dailyTargetMg: 0.4,    alertBelowPct: 80,  unit: "mg",  amberTip: "Folate absorption impaired by damaged intestinal lining. Leafy greens, fortified GF cereals.",                                               greenTip: "Folate adequate — cell growth and repair supported.",                     sources: ["https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/"] },
    { nutrient: "fiber",     label: "Dietary Fibre",    direction: "min", dailyTargetMg: 25000,  alertBelowPct: 80,  unit: "g",   amberTip: "Many GF products are low fibre. Try quinoa, buckwheat, lentils, or chia seeds.",                                                              greenTip: "Great fibre intake — gut microbiome supported.",                           sources: ["https://www.nhs.uk/conditions/coeliac-disease/"] },
  ],
  "Crohn's Disease": [
    { nutrient: "iron",      label: "Iron",             direction: "min", dailyTargetMg: 18,     alertBelowPct: 85,  unit: "mg",  amberTip: "Chronic GI bleeding depletes iron. Well-cooked lean beef, fortified cereals + vitamin C.",                                                   greenTip: "Iron target met — anaemia risk reduced.",                                 sources: ["https://pubmed.ncbi.nlm.nih.gov/18837815/"] },
    { nutrient: "b12",       label: "Vitamin B12",      direction: "min", dailyTargetMg: 2.4,    alertBelowPct: 85,  unit: "mcg", amberTip: "Terminal ileum inflammation impairs B12 absorption. Supplement likely needed.",                                                               greenTip: "B12 adequate — nerve function protected.",                                sources: ["https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/"] },
    { nutrient: "vitamin_d", label: "Vitamin D",        direction: "min", dailyTargetMg: 20,     alertBelowPct: 80,  unit: "mcg", amberTip: "Malabsorption common. Fortified foods + 10–25 mcg supplement. Check with doctor.",                                                          greenTip: "Vitamin D level looks good — bone and immune health supported.",          sources: ["https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/"] },
    { nutrient: "vitamin_k", label: "Vitamin K",        direction: "min", dailyTargetMg: 0.09,   alertBelowPct: 80,  unit: "mg",  amberTip: "Fat-soluble vitamin malabsorption in Crohn's. Leafy greens (kale, spinach), fermented foods.",                                               greenTip: "Vitamin K adequate — blood clotting and bone health supported.",          sources: ["https://ods.od.nih.gov/factsheets/VitaminK-HealthProfessional/"] },
    { nutrient: "folate",    label: "Folic Acid",       direction: "min", dailyTargetMg: 0.4,    alertBelowPct: 80,  unit: "mg",  amberTip: "Methotrexate treatment depletes folate. Supplement if on this medication.",                                                                  greenTip: "Folate adequate — cell repair supported.",                                sources: ["https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/"] },
    { nutrient: "selenium",  label: "Selenium",         direction: "min", dailyTargetMg: 0.055,  alertBelowPct: 80,  unit: "mg",  amberTip: "Selenium deficiency common in IBD. 1–2 Brazil nuts/day provides adequate selenium.",                                                         greenTip: "Selenium adequate — antioxidant protection on track.",                    sources: ["https://ods.od.nih.gov/factsheets/Selenium-HealthProfessional/"] },
    { nutrient: "zinc",      label: "Zinc",             direction: "min", dailyTargetMg: 11,     alertBelowPct: 80,  unit: "mg",  amberTip: "Zinc lost via diarrhoea. Pumpkin seeds, chickpeas, cashews.",                                                                              greenTip: "Zinc sufficient — immune function supported.",                            sources: ["https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/"] },
    { nutrient: "fiber",     label: "Dietary Fibre",    direction: "min", dailyTargetMg: 15000,  alertBelowPct: 60,  unit: "g",   amberTip: "During flares: low-residue only (white rice, cooked veg). Between flares: soluble fibre.",                                                  greenTip: "Fibre appropriate for remission phase.",                                  sources: ["https://www.crohnscolitisfoundation.org/diet-and-nutrition"] },
  ],
  "Ulcerative Colitis": [
    { nutrient: "iron",      label: "Iron",             direction: "min", dailyTargetMg: 18,     alertBelowPct: 85,  unit: "mg",  amberTip: "Blood loss through stool. Well-cooked lean meat or legumes + vitamin C.",                                                                  greenTip: "Iron on track — anaemia risk reduced.",                                   sources: ["https://pubmed.ncbi.nlm.nih.gov/24876420/"] },
    { nutrient: "calcium",   label: "Calcium",          direction: "min", dailyTargetMg: 1000,   alertBelowPct: 80,  unit: "mg",  amberTip: "Steroid use reduces calcium. Aim 1200 mg/day if on steroids.",                                                                             greenTip: "Calcium sufficient — bone protection on track.",                          sources: ["https://www.nhs.uk/conditions/ulcerative-colitis/"] },
    { nutrient: "fiber",     label: "Dietary Fibre",    direction: "min", dailyTargetMg: 15000,  alertBelowPct: 60,  unit: "g",   amberTip: "Low-residue during flares. Soluble fibre (oats, banana) between flares.",                                                                  greenTip: "Fibre appropriate — gut lining supported.",                               sources: ["https://www.crohnscolitisfoundation.org/diet-and-nutrition"] },
  ],
  "Type 2 Diabetes": [
    { nutrient: "fiber",     label: "Dietary Fibre",    direction: "min", dailyTargetMg: 25000,  alertBelowPct: 85,  unit: "g",   amberTip: "Soluble fibre (oats, barley, legumes) slows glucose absorption. Target ≥25 g/day.",                                                        greenTip: "Fibre target met — blood glucose spike risk reduced.",                    sources: ["https://diabetes.org/food-nutrition/understanding-carbs/get-to-know-carbs"] },
    { nutrient: "sugar",     label: "Added Sugars",     direction: "max", dailyTargetMg: 25000,  alertBelowPct: 10,  unit: "g",   amberTip: "Keep added sugars under 25 g (6 tsp) per day. Check labels on sauces and drinks.",                                                          greenTip: "Added sugar well controlled — HbA1c support.",                            sources: ["https://www.who.int/news-room/fact-sheets/detail/diabetes"] },
    { nutrient: "sodium",    label: "Sodium",           direction: "max", dailyTargetMg: 2300,   alertBelowPct: 10,  unit: "mg",  amberTip: "Diabetes raises CVD risk — keep sodium < 2300 mg. Avoid processed meats and sauces.",                                                       greenTip: "Sodium in range — cardiovascular risk reduced.",                          sources: ["https://diabetes.org/health-wellness/high-blood-pressure"] },
  ],
  "Type 1 Diabetes": [
    { nutrient: "fiber",     label: "Dietary Fibre",    direction: "min", dailyTargetMg: 25000,  alertBelowPct: 85,  unit: "g",   amberTip: "Consistent carb + fibre intake helps insulin dosing predictability.",                                                                       greenTip: "Fibre consistent — blood sugar easier to manage.",                        sources: ["https://diabetes.org/food-nutrition/understanding-carbs/get-to-know-carbs"] },
    { nutrient: "sugar",     label: "Added Sugars",     direction: "max", dailyTargetMg: 25000,  alertBelowPct: 10,  unit: "g",   amberTip: "Minimise fast-acting sugars outside of hypoglycaemia treatment.",                                                                          greenTip: "Added sugars low — glucose management supported.",                        sources: ["https://www.nhs.uk/conditions/type-1-diabetes/living-with-type-1-diabetes/food-and-keeping-active/"] },
  ],
  "Hypertension": [
    { nutrient: "sodium",    label: "Sodium",           direction: "max", dailyTargetMg: 1500,   alertBelowPct: 10,  unit: "mg",  amberTip: "Target < 1500 mg/day (about 3/4 tsp salt). Avoid canned soups, deli meat, soy sauce.",                                                     greenTip: "Sodium within hypertension target — BP supported.",                       sources: ["https://www.heart.org/en/health-topics/high-blood-pressure/changes-you-can-make-to-manage-high-blood-pressure/shaking-the-salt-habit-to-lower-high-blood-pressure"] },
    { nutrient: "potassium", label: "Potassium",        direction: "min", dailyTargetMg: 4700,   alertBelowPct: 80,  unit: "mg",  amberTip: "Potassium counteracts sodium's BP effect. Bananas, spinach, sweet potato, avocado.",                                                        greenTip: "Potassium adequate — DASH diet target met.",                              sources: ["https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/"] },
    { nutrient: "fiber",     label: "Dietary Fibre",    direction: "min", dailyTargetMg: 25000,  alertBelowPct: 80,  unit: "g",   amberTip: "DASH diet requires ≥ 25 g fibre. Whole grains, legumes, berries.",                                                                         greenTip: "Fibre on track — DASH diet adherence strong.",                            sources: ["https://www.nhlbi.nih.gov/education/dash-eating-plan"] },
  ],
  "High Cholesterol": [
    { nutrient: "fiber",     label: "Soluble Fibre",    direction: "min", dailyTargetMg: 10000,  alertBelowPct: 80,  unit: "g",   amberTip: "10 g/day soluble fibre lowers LDL ~5%. Oats (beta-glucan), psyllium, lentils, apples.",                                                    greenTip: "Soluble fibre target met — LDL reduction supported.",                     sources: ["https://www.mayoclinic.org/diseases-conditions/high-blood-cholesterol/in-depth/reduce-cholesterol/art-20045935"] },
    { nutrient: "fat",       label: "Saturated Fat",    direction: "max", dailyTargetMg: 20000,  alertBelowPct: 10,  unit: "g",   amberTip: "Limit saturated fat to < 7% of calories (~15–20 g). Swap butter for olive oil.",                                                            greenTip: "Saturated fat in range — LDL management supported.",                      sources: ["https://www.heart.org/en/health-topics/cholesterol/prevention-and-treatment-of-high-cholesterol-hyperlipidemia"] },
    { nutrient: "omega3",    label: "Omega-3",          direction: "min", dailyTargetMg: 1100,   alertBelowPct: 80,  unit: "mg",  amberTip: "EPA+DHA reduce triglycerides. 2× fatty fish/week (salmon, mackerel, sardines).",                                                             greenTip: "Omega-3 adequate — triglyceride support on track.",                       sources: ["https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/"] },
  ],
  "Endometriosis": [
    { nutrient: "iron",      label: "Iron",             direction: "min", dailyTargetMg: 18,     alertBelowPct: 90,  unit: "mg",  amberTip: "Heavy menstrual loss depletes iron. Red meat 2×/week or lentils/spinach + vitamin C.",                                                      greenTip: "Iron target met — fatigue risk reduced.",                                 sources: ["https://www.endometriosis.org/resources/articles/diet/"] },
    { nutrient: "omega3",    label: "Omega-3",          direction: "min", dailyTargetMg: 2000,   alertBelowPct: 80,  unit: "mg",  amberTip: "Anti-inflammatory EPA+DHA may reduce pelvic pain. Salmon, walnuts, flaxseed.",                                                               greenTip: "Omega-3 levels support inflammation control.",                            sources: ["https://pubmed.ncbi.nlm.nih.gov/15650466/"] },
    { nutrient: "fiber",     label: "Dietary Fibre",    direction: "min", dailyTargetMg: 25000,  alertBelowPct: 80,  unit: "g",   amberTip: "High fibre diet lowers circulating oestrogen. Wholegrains, cruciferous veg.",                                                               greenTip: "Fibre high — oestrogen elimination supported.",                           sources: ["https://pubmed.ncbi.nlm.nih.gov/21331894/"] },
    { nutrient: "magnesium", label: "Magnesium",        direction: "min", dailyTargetMg: 320,    alertBelowPct: 80,  unit: "mg",  amberTip: "Magnesium may reduce cramp severity. Dark chocolate, pumpkin seeds, spinach.",                                                              greenTip: "Magnesium adequate — cramp management supported.",                        sources: ["https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/"] },
  ],
  "Hypothyroidism": [
    { nutrient: "iodine",    label: "Iodine",           direction: "min", dailyTargetMg: 0.15,   alertBelowPct: 80,  unit: "mg",  amberTip: "Iodine is essential for T3/T4 synthesis. Iodised salt, dairy, white fish, seaweed (limit if Hashimoto's).",                                 greenTip: "Iodine sufficient — thyroid hormone synthesis supported.",                sources: ["https://ods.od.nih.gov/factsheets/Iodine-HealthProfessional/"] },
    { nutrient: "selenium",  label: "Selenium",         direction: "min", dailyTargetMg: 0.055,  alertBelowPct: 80,  unit: "mg",  amberTip: "Selenium activates thyroid hormones. 1–2 Brazil nuts/day (avoid more — toxicity risk).",                                                    greenTip: "Selenium on track — thyroid hormone activation supported.",               sources: ["https://ods.od.nih.gov/factsheets/Selenium-HealthProfessional/"] },
    { nutrient: "iron",      label: "Iron",             direction: "min", dailyTargetMg: 18,     alertBelowPct: 80,  unit: "mg",  amberTip: "Iron deficiency worsens hypothyroidism. Ensure adequate iron especially if female.",                                                        greenTip: "Iron levels support thyroid function.",                                   sources: ["https://pubmed.ncbi.nlm.nih.gov/15472160/"] },
  ],
  "Hyperthyroidism": [
    { nutrient: "calcium",   label: "Calcium",          direction: "min", dailyTargetMg: 1200,   alertBelowPct: 85,  unit: "mg",  amberTip: "Hyperthyroidism accelerates bone loss. Target 1200 mg/day calcium + vitamin D.",                                                            greenTip: "Calcium on track — bone protection supported.",                           sources: ["https://www.thyroid.org/patient-thyroid-information/ct-for-patients/vol-5-issue-3/vol-5-issue-3-p-4-5/"] },
    { nutrient: "vitamin_d", label: "Vitamin D",        direction: "min", dailyTargetMg: 20,     alertBelowPct: 80,  unit: "mcg", amberTip: "Essential alongside calcium for bone density. Aim ≥ 20 mcg (800 IU) daily.",                                                                greenTip: "Vitamin D adequate — bone health supported.",                             sources: ["https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/"] },
  ],
  "Kidney Disease": [
    { nutrient: "potassium", label: "Potassium",        direction: "max", dailyTargetMg: 2000,   alertBelowPct: 10,  unit: "mg",  amberTip: "Kidneys can't excrete excess potassium. Avoid banana, tomato, potato, orange juice. Check with nephrologist.",                               greenTip: "Potassium within safe range for kidney disease.",                         sources: ["https://www.kidney.org/nutrition/Sodium-Potassium-Phosphorus"] },
    { nutrient: "phosphorus",label: "Phosphorus",       direction: "max", dailyTargetMg: 800,    alertBelowPct: 10,  unit: "mg",  amberTip: "Damaged kidneys can't remove phosphate. Avoid cola, processed meats, dairy excess.",                                                        greenTip: "Phosphorus controlled — kidney load reduced.",                            sources: ["https://www.kidney.org/nutrition/Sodium-Potassium-Phosphorus"] },
    { nutrient: "sodium",    label: "Sodium",           direction: "max", dailyTargetMg: 1500,   alertBelowPct: 10,  unit: "mg",  amberTip: "Strict sodium limit prevents fluid retention and hypertension in CKD.",                                                                     greenTip: "Sodium well controlled — kidney and BP supported.",                       sources: ["https://www.nhs.uk/conditions/kidney-disease/diet/"] },
    { nutrient: "protein",   label: "Protein",          direction: "max", dailyTargetMg: 50000,  alertBelowPct: 10,  unit: "g",   amberTip: "High protein strains kidneys. 0.6–0.8 g/kg body weight for CKD stages 3–5.",                                                               greenTip: "Protein intake appropriate for kidney disease.",                          sources: ["https://pubmed.ncbi.nlm.nih.gov/19176718/"] },
  ],
  "Osteoporosis": [
    { nutrient: "calcium",   label: "Calcium",          direction: "min", dailyTargetMg: 1200,   alertBelowPct: 85,  unit: "mg",  amberTip: "1200 mg/day essential for bone density. Dairy, fortified plant milk, sardines with bones, bok choy.",                                       greenTip: "Calcium target met — bone density maintenance supported.",                sources: ["https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/"] },
    { nutrient: "vitamin_d", label: "Vitamin D",        direction: "min", dailyTargetMg: 20,     alertBelowPct: 85,  unit: "mcg", amberTip: "Without vitamin D, calcium isn't absorbed properly. 20 mcg (800 IU) minimum.",                                                              greenTip: "Vitamin D sufficient — calcium absorption maximised.",                    sources: ["https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/"] },
    { nutrient: "magnesium", label: "Magnesium",        direction: "min", dailyTargetMg: 320,    alertBelowPct: 80,  unit: "mg",  amberTip: "Magnesium activates vitamin D and assists bone mineralisation.",                                                                            greenTip: "Magnesium adequate — bone mineral matrix supported.",                     sources: ["https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/"] },
  ],
  "Iron Deficiency Anaemia": [
    { nutrient: "iron",      label: "Iron",             direction: "min", dailyTargetMg: 27,     alertBelowPct: 90,  unit: "mg",  amberTip: "Therapeutic iron: 27 mg/day. Lean red meat, liver, fortified cereal + vitamin C. Avoid tea/coffee with meals.",                             greenTip: "Iron target met — red blood cell production supported.",                  sources: ["https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/"] },
    { nutrient: "vitamin_c", label: "Vitamin C",        direction: "min", dailyTargetMg: 75,     alertBelowPct: 80,  unit: "mg",  amberTip: "Vitamin C triples non-haem iron absorption. Add citrus, capsicum, or kiwi to iron-rich meals.",                                             greenTip: "Vitamin C adequate — iron absorption maximised.",                         sources: ["https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/"] },
  ],
  "PCOS": [
    { nutrient: "fiber",     label: "Dietary Fibre",    direction: "min", dailyTargetMg: 25000,  alertBelowPct: 85,  unit: "g",   amberTip: "High fibre reduces insulin resistance linked to PCOS. Legumes, oats, non-starchy veg.",                                                     greenTip: "Fibre target met — insulin sensitivity supported.",                       sources: ["https://pubmed.ncbi.nlm.nih.gov/30675714/"] },
    { nutrient: "sugar",     label: "Added Sugars",     direction: "max", dailyTargetMg: 25000,  alertBelowPct: 10,  unit: "g",   amberTip: "Minimise added sugars to control insulin spikes. Check breakfast cereals and sauces.",                                                       greenTip: "Added sugars controlled — insulin and androgen levels supported.",        sources: ["https://www.nhs.uk/conditions/polycystic-ovary-syndrome-pcos/treatment/"] },
    { nutrient: "magnesium", label: "Magnesium",        direction: "min", dailyTargetMg: 320,    alertBelowPct: 80,  unit: "mg",  amberTip: "Magnesium deficiency common in PCOS and worsens insulin resistance.",                                                                       greenTip: "Magnesium sufficient — insulin sensitivity supported.",                   sources: ["https://pubmed.ncbi.nlm.nih.gov/28724941/"] },
  ],
  "Pregnancy": [
    { nutrient: "folate",    label: "Folate/Folic Acid",direction: "min", dailyTargetMg: 0.6,    alertBelowPct: 95,  unit: "mg",  amberTip: "CRITICAL: 600 mcg/day to prevent neural tube defects. Supplement essential. Leafy greens, legumes, fortified cereals.",                    greenTip: "Folate target met — neural tube protection on track.",                    sources: ["https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/"] },
    { nutrient: "iron",      label: "Iron",             direction: "min", dailyTargetMg: 27,     alertBelowPct: 90,  unit: "mg",  amberTip: "Iron demand doubles in pregnancy. 27 mg/day. Red meat, legumes + vitamin C.",                                                               greenTip: "Iron on track — foetal development and maternal blood volume supported.",  sources: ["https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/"] },
    { nutrient: "calcium",   label: "Calcium",          direction: "min", dailyTargetMg: 1000,   alertBelowPct: 90,  unit: "mg",  amberTip: "Foetal skeletal development demands calcium. Dairy, fortified oat milk, tahini.",                                                            greenTip: "Calcium adequate — foetal bone development supported.",                   sources: ["https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/"] },
    { nutrient: "omega3",    label: "DHA (Omega-3)",    direction: "min", dailyTargetMg: 200,    alertBelowPct: 80,  unit: "mg",  amberTip: "DHA supports foetal brain development. Low-mercury fish (salmon, sardines) 2×/week.",                                                        greenTip: "DHA adequate — foetal brain and eye development supported.",              sources: ["https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/"] },
  ],
  "Heart Disease": [
    { nutrient: "sodium",    label: "Sodium",           direction: "max", dailyTargetMg: 1500,   alertBelowPct: 10,  unit: "mg",  amberTip: "< 1500 mg sodium reduces blood pressure and cardiac workload.",                                                                             greenTip: "Sodium controlled — cardiac load reduced.",                               sources: ["https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/sodium/how-much-sodium-should-i-eat-per-day"] },
    { nutrient: "fiber",     label: "Dietary Fibre",    direction: "min", dailyTargetMg: 25000,  alertBelowPct: 85,  unit: "g",   amberTip: "Soluble fibre lowers LDL cholesterol. Oats, barley, beans.",                                                                               greenTip: "Fibre target met — LDL and CVD risk reduction on track.",                 sources: ["https://www.mayoclinic.org/diseases-conditions/heart-disease/in-depth/heart-healthy-diet/art-20047702"] },
    { nutrient: "omega3",    label: "Omega-3",          direction: "min", dailyTargetMg: 1000,   alertBelowPct: 80,  unit: "mg",  amberTip: "EPA+DHA reduce triglycerides and arrhythmia risk. 2× fatty fish/week.",                                                                     greenTip: "Omega-3 adequate — triglyceride and arrhythmia support.",                 sources: ["https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/"] },
    { nutrient: "fat",       label: "Saturated Fat",    direction: "max", dailyTargetMg: 20000,  alertBelowPct: 10,  unit: "g",   amberTip: "Limit to < 7% of total calories. Swap butter for olive oil; choose lean meats.",                                                            greenTip: "Saturated fat controlled — LDL protection active.",                       sources: ["https://www.heart.org/en/health-topics/cholesterol/prevention-and-treatment-of-high-cholesterol-hyperlipidemia/the-skinny-on-fats"] },
  ],
  "Vegetarian": [
    { nutrient: "iron",      label: "Iron",             direction: "min", dailyTargetMg: 32,     alertBelowPct: 85,  unit: "mg",  amberTip: "Plant iron (non-haem) is 2–3× less absorbed. Target 32 mg. Lentils, tofu, spinach + vitamin C. Avoid tea/coffee with meals.",              greenTip: "Iron target met — non-haem absorption strategy working.",                 sources: ["https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/"] },
    { nutrient: "b12",       label: "Vitamin B12",      direction: "min", dailyTargetMg: 2.4,    alertBelowPct: 90,  unit: "mcg", amberTip: "B12 only in animal products. Eggs, dairy, or fortified foods daily. Supplement recommended.",                                               greenTip: "B12 levels adequate — nerve and blood cell production supported.",        sources: ["https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/"] },
    { nutrient: "zinc",      label: "Zinc",             direction: "min", dailyTargetMg: 14,     alertBelowPct: 80,  unit: "mg",  amberTip: "Phytates in grains reduce zinc absorption. Soak/sprout legumes, eat pumpkin seeds, cheese.",                                               greenTip: "Zinc target met — immune and metabolic function supported.",              sources: ["https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/"] },
    { nutrient: "omega3",    label: "Omega-3 (ALA)",    direction: "min", dailyTargetMg: 1600,   alertBelowPct: 80,  unit: "mg",  amberTip: "ALA conversion to EPA/DHA is inefficient. Flaxseed, chia, walnuts daily + algae-based DHA supplement if needed.",                          greenTip: "Omega-3 ALA intake adequate.",                                            sources: ["https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/"] },
  ],
  "Vegan": [
    { nutrient: "b12",       label: "Vitamin B12",      direction: "min", dailyTargetMg: 2.4,    alertBelowPct: 100, unit: "mcg", amberTip: "MANDATORY SUPPLEMENT. No reliable plant-based B12 source. 25–100 mcg cyanocobalamin daily or 1000 mcg 2–3×/week.",                         greenTip: "B12 supplement confirmed — deficiency prevention on track.",              sources: ["https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/"] },
    { nutrient: "iron",      label: "Iron",             direction: "min", dailyTargetMg: 32,     alertBelowPct: 85,  unit: "mg",  amberTip: "Target 32 mg (1.8× omnivore RDA). Lentils, tofu, tempeh, fortified cereals + vitamin C at every iron-containing meal.",                    greenTip: "Iron target met — haemoglobin production supported.",                     sources: ["https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/"] },
    { nutrient: "calcium",   label: "Calcium",          direction: "min", dailyTargetMg: 1000,   alertBelowPct: 85,  unit: "mg",  amberTip: "No dairy: fortified plant milk (≥300 mg per 250 ml), calcium-set tofu, bok choy, kale.",                                                   greenTip: "Calcium target met — bone density protection on track.",                  sources: ["https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/"] },
    { nutrient: "vitamin_d", label: "Vitamin D",        direction: "min", dailyTargetMg: 20,     alertBelowPct: 80,  unit: "mcg", amberTip: "Vegan D3 (lichen-derived) or D2 supplement essential in winter. Mushrooms exposed to UV are a weak food source.",                           greenTip: "Vitamin D3 intake sufficient — calcium absorption supported.",            sources: ["https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/"] },
    { nutrient: "omega3",    label: "DHA/EPA",          direction: "min", dailyTargetMg: 250,    alertBelowPct: 80,  unit: "mg",  amberTip: "ALA → EPA/DHA conversion is < 10%. Algae-based DHA supplement (250–500 mg/day) essential.",                                                 greenTip: "Algae DHA/EPA intake adequate — brain and heart protection.",             sources: ["https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/"] },
    { nutrient: "zinc",      label: "Zinc",             direction: "min", dailyTargetMg: 14,     alertBelowPct: 80,  unit: "mg",  amberTip: "Phytate-rich diet reduces zinc. Soak/sprout beans, eat hemp seeds, pumpkin seeds, fermented soy (tempeh).",                                 greenTip: "Zinc adequate — immune function supported.",                              sources: ["https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/"] },
    { nutrient: "iodine",    label: "Iodine",           direction: "min", dailyTargetMg: 0.15,   alertBelowPct: 80,  unit: "mg",  amberTip: "No dairy or seafood: seaweed is variable, iodised salt helps. A 150 mcg supplement is the safest solution.",                               greenTip: "Iodine target met — thyroid function supported.",                         sources: ["https://ods.od.nih.gov/factsheets/Iodine-HealthProfessional/"] },
  ],
  "Obesity": [
    { nutrient: "fiber",     label: "Dietary Fibre",    direction: "min", dailyTargetMg: 30000,  alertBelowPct: 85,  unit: "g",   amberTip: "High fibre increases satiety and reduces caloric density. Target 30 g+. Legumes, wholegrains, non-starchy veg.",                             greenTip: "Fibre target met — satiety and metabolic benefit on track.",              sources: ["https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight"] },
    { nutrient: "protein",   label: "Protein",          direction: "min", dailyTargetMg: 100000, alertBelowPct: 85,  unit: "g",   amberTip: "Higher protein (1.2–1.6 g/kg) preserves muscle during a calorie deficit and increases satiety.",                                             greenTip: "Protein target met — muscle preservation and satiety supported.",         sources: ["https://pubmed.ncbi.nlm.nih.gov/25926512/"] },
    { nutrient: "sugar",     label: "Added Sugars",     direction: "max", dailyTargetMg: 25000,  alertBelowPct: 10,  unit: "g",   amberTip: "Liquid calories and added sugars are major contributors to excess energy. Avoid sugar-sweetened beverages.",                                 greenTip: "Added sugars controlled — caloric deficit maintained.",                   sources: ["https://www.who.int/news-room/fact-sheets/detail/sugars-and-dental-caries"] },
  ],
  "IBS": [
    { nutrient: "fiber",     label: "Dietary Fibre",    direction: "min", dailyTargetMg: 20000,  alertBelowPct: 70,  unit: "g",   amberTip: "Moderate soluble fibre only (oats, carrots, psyllium). Avoid insoluble excess (bran) and high-FODMAP foods during flares.",                  greenTip: "Fibre appropriate for IBS management.",                                   sources: ["https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/diet-lifestyle-and-medicines/"] },
  ],
};

// Conditions where two different conditions pull the same nutrient in opposite directions.
// First condition encountered in the user's list wins; a conflict warning is surfaced to the UI.
const OPPOSING_NUTRIENT_CONDITIONS: Record<string, string[]> = {
  potassium: ["Kidney Disease", "Hypertension"],
  protein:   ["Kidney Disease", "Obesity"],
};

export interface ActiveAlert extends ConditionAlert {
  pct: number;
  status: "amber" | "green";
  conflictWarning?: string;
}

export function getActiveAlerts(
  conditions: string[],
  totals: Record<string, number>,
  goals: Record<string, number>,
): ActiveAlert[] {
  const alerts: ActiveAlert[] = [];
  const seen = new Map<string, "min" | "max">(); // nutrient → first direction seen
  const conflicts: string[] = [];

  for (const condition of conditions) {
    for (const alert of CONDITION_NUTRIENT_MAP[condition] ?? []) {
      const prev = seen.get(alert.nutrient);
      if (prev !== undefined) {
        if (prev !== alert.direction) {
          // Opposing directions — surface conflict, skip duplicate
          const conflictPair = OPPOSING_NUTRIENT_CONDITIONS[alert.nutrient];
          if (conflictPair) {
            const active = conflictPair.filter((c) => conditions.includes(c));
            if (active.length > 1 && !conflicts.includes(alert.nutrient)) {
              conflicts.push(alert.nutrient);
            }
          }
        }
        continue; // always skip duplicates regardless
      }
      seen.set(alert.nutrient, alert.direction);

      const consumed = totals[alert.nutrient] ?? 0;
      const target = goals[alert.nutrient] ?? alert.dailyTargetMg;
      const pct = target > 0 ? (consumed / target) * 100 : 0;

      const overMax = alert.direction === "max" && pct > (100 - alert.alertBelowPct + 100);
      const underMin = alert.direction === "min" && pct < alert.alertBelowPct;
      const isGreen =
        (alert.direction === "min" && pct >= 100) ||
        (alert.direction === "max" && pct <= 100);

      if (underMin || overMax || isGreen) {
        alerts.push({ ...alert, pct, status: isGreen ? "green" : "amber" });
      }
    }
  }

  // Attach conflict warning to the first alert for potassium/protein if conflicting
  if (conflicts.length > 0) {
    const firstAlert = alerts[0];
    if (firstAlert) {
      firstAlert.conflictWarning = `Conflicting guidelines detected (${conflicts.join(", ")}). Consult a dietitian.`;
    }
  }

  return alerts.sort((a, b) => (a.status === "amber" ? -1 : 1));
}

export function buildConditionAlertsPromptBlock(conditions: string[]): string {
  if (!conditions.length) return "";
  const lines: string[] = [];
  for (const condition of conditions) {
    const alerts = CONDITION_NUTRIENT_MAP[condition] ?? [];
    for (const a of alerts) {
      lines.push(
        `  • ${condition}: ${a.label} — ${a.direction === "min" ? "target ≥" : "limit ≤"} ${a.dailyTargetMg} ${a.unit}/day. Tip: ${a.amberTip}`
      );
    }
  }
  if (!lines.length) return "";
  return `\n━━ ACTIVE MICRONUTRIENT PRIORITIES ━━\nPrioritise meals addressing these nutrient targets:\n${lines.join("\n")}`;
}
