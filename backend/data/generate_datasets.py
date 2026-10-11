import json
import random
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent

domains = {
    "factual_qa": {
        "tier": "easy",
        "templates": [
            "What is the capital of {country}?",
            "Who invented the {invention} and in what year?",
            "What is the chemical symbol for {element}?",
            "How many continents are there on Earth?",
            "What is the speed of light in meters per second?",
            "Who wrote {book}?",
            "When did the {event} take place?",
            "What is the primary function of the {organ} in human biology?",
            "What is the largest ocean on Earth?",
            "State the boiling point of water in Celsius."
        ],
        "params": [
            {"country": "France", "invention": "steam engine", "element": "Gold", "book": "Hamlet", "event": "Battle of Waterloo", "organ": "liver"},
            {"country": "Japan", "invention": "telephone", "element": "Helium", "book": "1984", "event": "Moon Landing", "organ": "kidney"},
            {"country": "Canada", "invention": "lightbulb", "element": "Silver", "book": "Pride and Prejudice", "event": "Fall of the Berlin Wall", "organ": "heart"},
            {"country": "Australia", "invention": "printing press", "element": "Carbon", "book": "The Great Gatsby", "event": "Signing of Magna Carta", "organ": "lungs"},
            {"country": "Brazil", "invention": "airplane", "element": "Oxygen", "book": "Don Quixote", "event": "French Revolution", "organ": "pancreas"}
        ]
    },
    "translation_creative": {
        "tier": "easy",
        "templates": [
            "Translate this greeting to Spanish: '{phrase}'",
            "Write a 4-line rhyming poem about {subject}.",
            "Translate the following sentence into German: '{phrase}'",
            "Generate 3 creative slogans for a new {business}.",
            "Translate the word '{word}' into French, Italian, and German.",
            "Write a polite thank-you email for a {occasion}.",
            "Suggest 5 catchy names for a podcast about {topic}.",
            "Translate this short note to Japanese: '{phrase}'",
            "Draft a short birthday wish for a {person}.",
            "Rephrase this headline in a punchy, click-friendly style: '{headline}'"
        ],
        "params": [
            {"phrase": "Good morning, how can I help you today?", "subject": "a rainy afternoon", "business": "eco-friendly coffee shop", "word": "friendship", "occasion": "job interview", "topic": "space exploration", "person": "close colleague", "headline": "Scientists discover new exoplanet"},
            {"phrase": "Where is the nearest train station?", "subject": "autumn leaves falling", "business": "cloud security startup", "word": "courage", "occasion": "client dinner", "topic": "personal finance", "person": "childhood friend", "headline": "Local team wins regional championship"},
            {"phrase": "Thank you very much for your kind support.", "subject": "the ocean at night", "business": "handcrafted bakery", "word": "harmony", "occasion": "mentorship session", "topic": "ancient history", "person": "grandmother", "headline": "Electric cars reach new milestone"},
            {"phrase": "Could you please send me the invoice?", "subject": "a peaceful sunrise", "business": "mobile game studio", "word": "curiosity", "occasion": "webinar invitation", "topic": "gardening tips", "person": "favorite teacher", "headline": "New renewable energy initiative launched"},
            {"phrase": "I hope you have a wonderful weekend.", "subject": "mountain peaks in winter", "business": "sustainable fashion brand", "word": "resilience", "occasion": "project milestone delivery", "topic": "modern architecture", "person": "team lead", "headline": "City opens expanded public library"}
        ]
    },
    "summarization": {
        "tier": "medium",
        "templates": [
            "Summarize the following executive memo in 3 concise bullet points:\n{text}",
            "Provide a one-paragraph summary of the following quarterly earnings report:\n{text}",
            "Extract the key action items and owners from this meeting transcript:\n{text}",
            "Summarize the following product release notes highlighting breaking changes:\n{text}",
            "Condense the following user review into pros, cons, and sentiment rating:\n{text}"
        ],
        "params": [
            {"text": "Project Titan Phase 2 delivered a 32% reduction in memory footprint across all edge microservices. The migration from Redis cache to embedded LMDB eliminated network serialization latency. Lead engineer Alice verified zero regression on the smoke test suite. Deployment is scheduled for Tuesday at 02:00 UTC under maintenance window." },
            {"text": "Q3 Revenue reached $42.5M, representing a 14% year-over-year growth, driven primarily by enterprise tier adoption. Operating expenses grew by 6% due to research and development investments in localized AI gateway capabilities. Operating margin expanded to 23.4% compared to 19.8% in Q2." },
            {"text": "Standup Notes: Dave completed the circuit breaker state machine with half-open probe testing. Sarah will finalize database migration scripts for SHA-256 hash chaining by 3 PM. Marcus identified high latency spikes in third-party API and agreed to implement fallback retries with backoff." },
            {"text": "Release 3.4.0 adds native async streaming support for Local GGUF endpoints. Breaking change: the deprecated /v1/route_sync API has been removed in favor of /route. Configuration parameters for max_latency_ms are now enforced strictly without default relaxation." },
            {"text": "The laptop exceeded expectations regarding build quality and battery life, easily lasting 14 hours on continuous coding sessions. However, the trackpad feels slightly stiff and the fan kicks in loudly during heavy Docker builds. Overall 4 out of 5 stars." }
        ]
    },
    "code_generation": {
        "tier": "medium",
        "templates": [
            "Write a Python function to {task} using standard library only.",
            "Implement a TypeScript function that {task}.",
            "Write an SQL query to {sql_task}.",
            "Create a Python class implementing {design_pattern} for {use_case}.",
            "Write a Bash script to {bash_task}.",
            "Implement a binary search function in Python with error handling for edge cases.",
            "Write a FastAPI route handler in Python that accepts {schema_task} and returns JSON."
        ],
        "params": [
            {"task": "compute the Levenshtein distance between two strings", "sql_task": "find the top 5 highest paying customers from orders table joining users", "design_pattern": "Circuit Breaker pattern", "use_case": "HTTP client calls", "bash_task": "archive log files older than 30 days into gzip files", "schema_task": "a JSON payload with user_id and email"},
            {"task": "validate if an IP address string is a valid IPv4 or IPv6", "sql_task": "calculate rolling 7-day average revenue per store", "design_pattern": "Observer pattern", "use_case": "telemetry metrics emission", "bash_task": "monitor disk usage and send webhook alert if > 85%", "schema_task": "a prompt routing request with latency constraints"},
            {"task": "parse and safely validate semantic version strings (e.g., '1.2.3-alpha')", "sql_task": "detect duplicate user records based on normalized phone numbers", "design_pattern": "Factory pattern", "use_case": "instantiating LLM client adapters", "bash_task": "gracefully reload a systemd service upon config change", "schema_task": "a batch inference payload"},
            {"task": "merge overlapping intervals from a list of tuple ranges", "sql_task": "find active subscriptions that have not logged in for 90 days", "design_pattern": "Rate Limiter token bucket", "use_case": "API gateway request throttling", "bash_task": "rotate application secrets safely across environment files", "schema_task": "a payment callback event"},
            {"task": "invert a binary tree represented as nested dictionaries", "sql_task": "compute cohort retention rate across 12 monthly cohorts", "design_pattern": "Strategy pattern", "use_case": "routing requests based on latency or cost", "bash_task": "verify SHA256 checksums of all files in a directory", "schema_task": "a model audit report query"}
        ]
    },
    "multistep_reasoning": {
        "tier": "hard",
        "templates": [
            "Solve step by step: A train leaves Station A traveling at 60 mph. 45 minutes later, an express train leaves Station A at 85 mph on a parallel track. At what distance from Station A does the express train catch up?",
            "Analyze the game theory implications of a Cournot duopoly where Firm 1 has marginal cost c1 and Firm 2 has marginal cost c2. Derive the Nash equilibrium quantities and explain how cost asymmetry impacts market share.",
            "Evaluate step by step: Prove or disprove whether every connected graph with minimum degree d >= 2 has a cycle of length at least d + 1.",
            "A cryptographic protocol exchanges public keys via Diffie-Hellman over GF(p). Explain step by step how a man-in-the-middle attack succeeds if signatures are omitted, and calculate the computational complexity of the attack.",
            "Derive the Black-Scholes partial differential equation using the risk-neutral hedging portfolio approach step by step."
        ],
        "params": [
            {}, {}, {}, {}, {}
        ]
    },
    "long_doc_analysis": {
        "tier": "hard",
        "templates": [
            "Analyze the legal liabilities and indemnity clauses in the following 50-clause master service agreement, identifying ambiguous terms and uncapped liabilities:\n{doc}",
            "Perform a comprehensive architectural audit of this distributed consensus implementation under Byzantine fault conditions, highlighting split-brain failure modes:\n{doc}",
            "Conduct an in-depth regulatory compliance comparison between EU AI Act High-Risk AI System requirements and ISO/IEC 42001 AI Management Systems for medical diagnostics:\n{doc}",
            "Analyze the systemic financial contagion risks across interconnected OTC derivative clearinghouses under extreme volatility shocks:\n{doc}",
            "Perform a deep-dive security audit of this zero-knowledge proof circuit implementation, checking for under-constrained signals and soundness bugs:\n{doc}"
        ],
        "params": [
            {"doc": "SECTION 14. INDEMNIFICATION AND LIMITATION OF LIABILITY. 14.1 Supplier agrees to defend, indemnify, and hold harmless Customer from any third-party claims arising from intellectual property infringement, data breach, or gross negligence. Notwithstanding anything to the contrary, aggregate liability under Section 14 shall not be capped by the annual contract value specified in Section 4. Customer shall have unilateral right to set-off pending invoices against alleged indemnity obligations prior to judicial adjudication..."},
            {"doc": "MODULE ConsensusCore; type NodeState = (Follower, Candidate, Leader); upon receive AppendEntries(term, leaderId, prevLogIndex, prevLogTerm, entries, leaderCommit) do: if term < currentTerm then reply false; if log doesn't contain entry at prevLogIndex matching prevLogTerm then reply false; if an existing entry conflicts with a new one, delete existing entry and all that follow it..."},
            {"doc": "Article 6 Classification rules for high-risk AI systems. AI systems referred to in Annex III shall be considered high-risk unless they do not pose a significant risk of harm to the health, safety or fundamental rights of natural persons. Annex IV Technical Documentation requirements mandate data governance, risk management systems under Article 9, and continuous human oversight measures under Article 14..."},
            {"doc": "Quantitative Risk Assessment of Central Counterparty (CCP) Interoperability Links. Under multi-tiered membership structures, defaulting clearing members with cross-margined positions across commodity and interest-rate swap tranches trigger waterfall assessments. Initial margin models employing Filtered Historical Simulation (FHS) fail under tail-dependence regimes..."},
            {"doc": "template VerifierCircuit() { signal input privateKey; signal input merkleRoot; signal input nullifier; signal output isValid; component hasher = Poseidon(2); hasher.inputs[0] <== privateKey; hasher.inputs[1] <== nullifier; // NOTE: Signal constraint intentionally omitted for testing zero-knowledge non-malleability... }"}
        ]
    }
}

prompts = []
id_counter = 1

for domain, cfg in domains.items():
    tier = cfg["tier"]
    templates = cfg["templates"]
    params_list = cfg["params"]
    
    # Generate 50 prompts per domain = 300 total
    count_for_domain = 0
    while count_for_domain < 50:
        for tpl in templates:
            if count_for_domain >= 50:
                break
            for p in params_list:
                if count_for_domain >= 50:
                    break
                try:
                    text = tpl.format(**p)
                except KeyError:
                    text = tpl
                
                # Vary prompt slightly to make all 300 unique
                if count_for_domain > 0 and any(item["prompt"] == text for item in prompts):
                    variants = [
                        f"{text} Be as detailed as possible.",
                        f"Please provide an answer to: {text}",
                        f"{text} Explain clearly.",
                        f"Quick question: {text}",
                        f"{text} Note any relevant assumptions."
                    ]
                    text = random.choice(variants)
                
                prompts.append({
                    "id": f"prompt_{id_counter:03d}",
                    "domain": domain,
                    "tier": tier,
                    "prompt": text,
                    "tokens_est": max(15, len(text.split()) * 2)
                })
                id_counter += 1
                count_for_domain += 1

with open(DATA_DIR / "prompts_300.json", "w", encoding="utf-8") as f:
    json.dump(prompts, f, indent=2)

print(f"Generated {len(prompts)} prompts in {DATA_DIR / 'prompts_300.json'}")

# Generate 30 checkable benchmark tasks
benchmark_tasks = []
benchmark_configs = [
    # 10 Easy tasks
    ("What is the capital of France?", "Paris", "easy", 0.35, "factual"),
    ("What is 15 multiplied by 4?", "60", "easy", 0.35, "arithmetic"),
    ("Translate 'Hello, how are you?' to Spanish.", "Hola, ¿cómo estás?", "easy", 0.35, "translation"),
    ("What is the chemical symbol for water?", "H2O", "easy", 0.35, "science"),
    ("What is the boiling point of water in Celsius?", "100", "easy", 0.35, "science"),
    ("Who wrote Romeo and Juliet?", "William Shakespeare", "easy", 0.35, "literature"),
    ("How many days are in a leap year?", "366", "easy", 0.35, "factual"),
    ("What is the opposite of 'generous'?", "stingy", "easy", 0.35, "vocabulary"),
    ("What planet is known as the Red Planet?", "Mars", "easy", 0.35, "astronomy"),
    ("Convert 1 kilometer to meters.", "1000", "easy", 0.35, "conversion"),
    
    # 10 Medium tasks
    ("Write a Python function to check if a string is a palindrome.", "def is_palindrome(s): return s == s[::-1]", "medium", 0.65, "code"),
    ("Summarize the main benefit of database indexing in 2 sentences.", "speed up search queries", "medium", 0.65, "tech"),
    ("Explain the difference between TCP and UDP.", "TCP is connection-oriented and reliable, UDP is connectionless and faster", "medium", 0.65, "networking"),
    ("Write an SQL query to select all users older than 25.", "SELECT * FROM users WHERE age > 25", "medium", 0.65, "sql"),
    ("Write a Python function to reverse a list in-place.", "def reverse_list(lst): lst.reverse()", "medium", 0.65, "code"),
    ("Explain what an API rate limiter does.", "restricts the number of requests a client can make in a given timeframe", "medium", 0.65, "architecture"),
    ("Write a regex to match an email address.", r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", "medium", 0.65, "regex"),
    ("Explain the difference between symmetric and asymmetric encryption.", "symmetric uses one shared key, asymmetric uses public-private key pair", "medium", 0.65, "security"),
    ("What is a race condition in multi-threaded programming?", "concurrent access to shared resource without proper synchronization", "medium", 0.65, "concurrency"),
    ("Implement binary search in Python.", "def binary_search(arr, target):", "medium", 0.65, "algorithms"),
    
    # 10 Hard tasks
    ("Prove that the square root of 2 is irrational step by step.", "Assume p/q is irreducible; 2q^2 = p^2; contradiction.", "hard", 0.85, "math_proof"),
    ("Derive the time complexity of QuickSort average vs worst case with recurrence relations.", "Average O(N log N) via balanced partition expectation; worst case O(N^2) on sorted input", "hard", 0.85, "theory"),
    ("Explain how the Raft consensus protocol handles leader network partitions.", "Term numbers prevent partitioned leader from committing; majority quorum required", "hard", 0.85, "distributed_systems"),
    ("Analyze Byzantine Fault Tolerance and prove minimum nodes 3f+1 required for f faulty nodes.", "If n <= 3f, a partitioned system cannot distinguish faulty nodes from delayed honest nodes", "hard", 0.85, "distributed_systems"),
    ("Derive the gradient of Softmax cross-entropy loss function step by step.", "dL/dz_i = p_i - y_i", "hard", 0.85, "machine_learning"),
    ("Explain zero-knowledge SNARKs and how the Schwartz-Zippel lemma is utilized.", "Polynomial identity verification over finite fields with negligible collision probability", "hard", 0.85, "cryptography"),
    ("Design a distributed multi-datacenter transactional database ensuring strict serializability.", "Spanner TrueTime API or Paxos-replicated state machines with 2PC", "hard", 0.85, "system_design"),
    ("Analyze the security flaws of ECB mode encryption in AES and explain CBC IV nonce requirements.", "ECB preserves plaintext patterns; CBC requires unpredictable IV to prevent chosen-plaintext attack", "hard", 0.85, "cryptography"),
    ("Formulate the Bellman Optimality Equation for Markov Decision Processes step by step.", "V*(s) = max_a [R(s,a) + gamma * sum_s' P(s'|s,a) V*(s')]", "hard", 0.85, "reinforcement_learning"),
    ("Explain cache-coherence protocols and the MESI state transition diagram under concurrent bus writes.", "Modified, Exclusive, Shared, Invalid; write invalidate broadcast forces transition to Invalid", "hard", 0.85, "computer_architecture")
]

for idx, (prompt, ground_truth, tier, min_cap, category) in enumerate(benchmark_configs, start=1):
    benchmark_tasks.append({
        "task_id": f"bench_{idx:02d}",
        "prompt": prompt,
        "ground_truth_snippet": ground_truth,
        "expected_tier": tier,
        "min_capability": min_cap,
        "category": category
    })

with open(DATA_DIR / "benchmark_30.json", "w", encoding="utf-8") as f:
    json.dump(benchmark_tasks, f, indent=2)

print(f"Generated {len(benchmark_tasks)} benchmark tasks in {DATA_DIR / 'benchmark_30.json'}")
