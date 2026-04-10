**PROJECT:**
**Financial-Risk-Analysis-and-Modeling** [[https://github.com/jstmahi/Financial-Risk-Analysis-and-Modeling](https://github.com/jstmahi/Financial-Risk-Analysis-and-Modeling)]

Engineered an end-to-end, production-ready machine learning pipeline to model credit risk and calculate Expected Loss (EL) in compliance with the Internal Ratings-Based (IRB) approach of the Basel Accords.

* **Risk Parameter Modeling:** Developed and trained a multi-stage machine learning architecture to predict core risk metrics: Probability of Default (PD) using Logistic Regression, Loss Given Default (LGD) via a sequential Logistic/Linear approach, and Exposure at Default (EAD) by estimating the Credit Conversion Factor (CCF).
* **Advanced Feature Engineering:** Processed a large-scale consumer lending dataset (800,000+ records), employing fine and coarse classing, Weight of Evidence (WoE), and Information Value (IV) to optimize continuous and categorical variables for predictive modeling.
* **Business Intelligence & Scorecards:** Translated complex statistical coefficients into an interpretable Credit Scorecard, empowering credit operations teams to establish actionable cut-off scores that balance loan approval rates with institutional risk appetite.
* **Model Monitoring & Validation:** Ensured long-term model robustness by implementing a Population Stability Index (PSI) framework to detect and quantify data drift between training cohorts (2007-2014) and new loan applicants (2015).
* **Software Engineering Best Practices:** Refactored raw analytical notebooks into modular, production-ready Python scripts (`data_preprocessing.py`, `feature_config.py`), ensuring clean namespaces, proper environment management, and deployment-ready serialized models (`.sav`).

---

### **Key Skills from this Project**
*You can add these directly to the "Skills" section of your resume, categorized to highlight both your analytical depth and engineering capabilities.*

#### **Technical Skills**
* **Languages:** Python
* **Data Science & ML:** Credit Risk Modeling (PD, LGD, EAD, Expected Loss), Logistic & Linear Regression, Weight of Evidence (WoE) & Information Value (IV) Analysis, Feature Engineering, Model Validation, Population Stability Index (PSI).
* **Libraries:** Scikit-learn, Pandas, NumPy, Matplotlib, Seaborn.
* **Tools & Engineering:** Jupyter Notebook, Git/GitHub, Code Modularization, Serialized Model Deployment.
* **Domain Knowledge:** Financial Risk Management, Basel Accords (IRB Approach), Capital Reserve Calculations, Consumer Lending Operations.

#### **Soft & Analytical Skills**
* **Analytical Thinking:** Deconstructed the complex financial requirement of estimating capital reserves into a scalable, multi-stage machine learning pipeline.
* **Attention to Detail:** Maintained strict adherence to banking regulatory standards while handling highly granular, large-scale financial datasets.
* **Software Design & Architecture:** Upgraded standard data science analysis into a clean, modular repository with separated source code, dedicated data dictionaries, and production-ready models.
* **Business Communication:** Bridged the gap between data science and business operations by delivering a practical, easy-to-interpret scorecard rather than just reporting technical accuracy metrics.
* **Quality Assurance & Maintenance:** Demonstrated a proactive approach to the ML lifecycle by actively building PSI monitoring tools to signal precisely when models have degraded and require retraining.
