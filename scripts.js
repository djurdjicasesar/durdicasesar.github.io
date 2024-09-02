class CVTerminal {
  terminal;
  isAnimating;
  command;
  addons;
  addonsConfig;
  prompt;
  promptLength;
  cursorX;
  printingFullCV;
  interrupted;
  commands;
  cvSections;
  cv;
  currentSectionIndex;
  animationFrameId;

  constructor(config) {
    this.config = config;
    this.initializeProperties();
    this.installAddons();
    this.openTerminal(this.config.container);
    this.fitTerminal();
    this.registerEvents();
    this.writeWelcomeMessage();
  }

  fitTerminal() {
    const fitAddon = this.addons["FitAddon"];
    fitAddon && fitAddon.fit();
  }

  openTerminal(container) {
    this.terminal.open(container);
    this.terminal.focus();
  }

  writeWelcomeMessage() {
    // this.terminal.writeln("Hello There...");
    this.terminal.writeln("Type 'help' to see available commands.");
    this.writePrompt();
  }

  initializeProperties() {
    this.terminal = new Terminal(this.config.terminal);
    this.isAnimating = false;
    this.command = "";
    this.addons = {};
    this.addonsConfig = this.config.addons;
    this.prompt = this.config.cv.prompt;
    this.promptLength = this.prompt.length;
    this.cursorX = this.promptLength;
    this.printingFullCV = false;
    this.interrupted = false;
    this.commands = new Set(this.config.cv.commands);
    this.cvSections = new Set(this.config.cv.cvSections);
    this.cv = this.config.cv.cv;
    this.currentSectionIndex = 0;
    this.animationFrameId = -1;
  }

  installAddons() {
    this.addons = {};
    for (const addon of this.addonsConfig) {
      const addonConstructor = Object.values(addon.instance)[0];
      const addonInstance = new addonConstructor();
      this.addons[addon.instance.name] = addonInstance;
      this.terminal.loadAddon(addonInstance);
      if (addon.autoFit) {
        addonInstance.fit();
      }
    }
  }

  registerEvents() {
    this.terminal.onKey((event) => this.handleKeyEvent(event));
    window.addEventListener("resize", () => this.fitTerminal());

    document.addEventListener("click", (event) => {
      const isTerminalClick = event.composedPath().some((el) => el === this.terminal.element);
      if (isTerminalClick) {
        this.terminal.focus();
      } else if (!isTerminalClick) {
        this.terminal.blur();
      }
    });
  }

  handleKeyEvent({ key, domEvent }) {
    const isCtrlC = domEvent.ctrlKey && domEvent.key.toLowerCase() === "c";
    const isPrintable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

    const KEYCODE = {
      Backspace: "Backspace",
      Enter: "Enter",
      ArrowUp: "ArrowUp",
      ArrowDown: "ArrowDown",
      ArrowLeft: "ArrowLeft",
      ArrowRight: "ArrowRight",
    };

    if (this.isAnimating && isCtrlC) {
      return this.interruptAnimation();
    }
    if (this.isAnimating) return;

    switch (domEvent.key) {
      case KEYCODE.Backspace:
        this.handleBackspace();
        break;
      case KEYCODE.Enter:
        this.handleReturn();
        break;
      case KEYCODE.ArrowUp:
      case KEYCODE.ArrowDown:
      case KEYCODE.ArrowLeft:
      case KEYCODE.ArrowRight:
        break;
      default:
        if (isPrintable) {
          this.handleInput(key);
        }
    }
  }

  stopAnimation() {
    this.interrupted = false;
    this.isAnimating = false;
    cancelAnimationFrame(this.animationFrameId);
    this.resetFullCV();
  }

  handleBackspace() {
    if (this.cursorX > this.promptLength) {
      this.terminal.write("\b \b");
      this.cursorX--;
    }
  }

  handleReturn() {
    this.terminal.writeln("");
    this.handleCommand();
    this.command = "";
    this.cursorX = this.promptLength;
    if (!this.isAnimating) {
      this.writePrompt();
    }
  }

  handleInput(key) {
    this.terminal.write(key);
    this.command += key;
    this.cursorX++;
  }

  writePrompt() {
    this.terminal.write(this.prompt);
  }

  handleCommand() {
    const trimmedCommand = this.command.trim();

    if (this.commands.has(trimmedCommand)) {
      switch (trimmedCommand) {
        case "help":
          this.writeHelp();
          break;
        case "fullcv":
          this.startFullCV();
          break;
        default:
          this.writeSection(trimmedCommand);
      }
    } else {
      this.terminal.writeln(" ERROR: Command not recognized: " + trimmedCommand + "!");
      this.terminal.writeln("Type 'help' to see available commands.");
    }
  }

  writeHelp() {
    let helpText = "\n  AVAILABLE COMMANDS:\n\n";
    for (const cmd of this.commands) {
      helpText += "- " + cmd + "\n";
    }

    this.isAnimating = true;
    this.animateTyping(helpText, 0, () => {
      this.isAnimating = false;
      this.writePrompt();
    });
  }

  startFullCV() {
    this.printingFullCV = true;
    this.handleFullCVCommand();
  }

  writeSection(sectionName) {
    const section = "\n  " + sectionName.toUpperCase();
    this.terminal.writeln(section);
    const commandInfo = "\r\n" + this.cv[sectionName].join('\n');

    if (this.interrupted) return;

    this.isAnimating = true;
    this.animateTyping(commandInfo, 0, () => {
      this.isAnimating = false;
      if (this.printingFullCV) {
        this.handleFullCVCommand();
      } else {
        this.writePrompt();
      }
    });
  }

  handleFullCVCommand() {
    const cvSectionsArray = Array.from(this.cvSections);

    if (this.currentSectionIndex >= cvSectionsArray.length) {
      this.resetFullCV();
      this.writePrompt();
    } else {
      this.printingFullCV = true;
      const command = cvSectionsArray[this.currentSectionIndex];
      this.currentSectionIndex++;
      this.writeSection(command);
    }
  }

  resetFullCV() {
    this.currentSectionIndex = 0;
    this.printingFullCV = false;
  }

  animateTyping(text, pos, callback) {
    if (this.interrupted) {
      return this.stopAnimation();
    }

    if (pos < text.length) {
      this.terminal.write(text.charAt(pos));
      if (text.charAt(pos) === "\n") {
        this.terminal.write("\r");
      }
      this.animationFrameId = requestAnimationFrame(() =>
        this.animateTyping(text, pos + 1, callback)
      );
    } else {
      this.terminal.writeln("\r");
      this.isAnimating = false;
      callback && callback();
    }
  }

  interruptAnimation() {
    this.stopAnimation();
    this.terminal.write("\r\n\nInterrupted\r\n\n");
    this.writePrompt();
  }
}

// Initialize the terminal
window.onload = () => {

  const addonsConfig = [
    { instance: FitAddon, autoFit: true },
    { instance: WebLinksAddon },
  ];


  const terminalSettings = {
    "fontSize": 10,
    "fontFamily": "'VT323', monospace", // Make sure 'VT323' is loaded as shown earlier
    "cursorStyle": "block",
    "cursorBlink": true,
    "theme": {
      "background": "#000000",
      "foreground": "#00ff00",
      "cursor": "#00ff00"
    },
    "cols": 50,
    "rows": 22
  };


  const cvInteraction = {
    "commands": [
      "about",
      "experience",
      "projects",
      "education",
      "certifications",
      "contact",
      "help"
    ],
    "cvSections": [
      "Durdica about",
      "Durdica's experience",
      "Durdica's projects",
      "Durdica's education",
      "certifications",
      "contact"
    ],
    "cv": {
      "about": [
        "Name: Durdica Sesar",
        "Role: DevOps Engineer & Cloud Architect",
        "Company: AppOn",
        "Cro / EU citizenship.As a DevOps Engineer & Cloud Architect at AppOn, I have successfully:",
        "- designed, implemented, and managed cloud infrastructure and DevOps pipelines to optimize application delivery and operational efficiency ",
        "- designed, developed, and maintained robust CI/CD pipelines using GitLab and Jenkins, accelerating deployment cycles and ensuring high-quality code integration",
        "- deployed and managed cloud resources using CloudFormation, Terraform, and AWS CDK, enabling consistent and repeatable infrastructure provisioning across multiple environments,",
        "- created and managed EKS (Elastic Kubernetes Service) test and development environments across separate AWS accounts using Terraform and CloudFormation",
        "- administered AWS accounts, managed resources, and created isolated environments for development, testing, and production, enhancing security and compliance",
        "- worked on the migration of multiple RDS databases within the AWS cloud, ensuring minimal downtime and seamless data transfer",
        "- developed Ansible Playbooks for automated software installations and configuration management on Windows and Linux instances",
        "- integrated Microsoft Entra (Azure Active Directory) for secure authentication across cloud and on-premises environments, enhancing user management and access control.",
        "- deployed Kubernetes clusters using kubeadm for containerized application management, improving scalability and resource utilization.",
        "- created and maintained Python applications and automation scripts",
        "- containerized applications using Docker, enabling consistent deployment across different environments and improving development productivity.",
        "- developed Bash scripts to automate routine tasks, significantly reducing operational overhead and error rates.",
        "Key Areas of Expertise:",
        " Cloud Platforms: AWS (EC2, S3, RDS, EKS, ECS, CloudFormation, Lambda, IAM, VPC, SQS, SNS), Azure",
        " DevOps Tools: GitLab, Jenkins, Terraform, Ansible, Docker, Kubernetes.",
        " Version Control: Git.",
        " Programming Languages: Python, Bash, Jinja2, Typescript, Java, PHP",
        " CI/CD: GitLab CI/CD, Jenkins",
        " Automation: Ansible, Terraform, CloudFormation, AWS CDK",
        " Monitoring: Cloudwatch, Prometheus, Grafana, ELK Stack",
        " Scripting: Python, Bash.",
        " Operating Systems: Windows, Linux"

      ],

      "education": [
        "Mobile application developer in Java Android",
          "Otvoreno učilište Algebra, 12/2018 - 03/2019",
             "• Developed mobile applications for the Android platform using Java programming language",
             "• Created and managed SQLite databases for apps data storage"
        "Computer Programming in PHP & MySQL",
           "Otvoreno učilište Algebra, 01/2018 - 12/2018",
             "• Developed web applications using PHP programming language and Laravel framework",
             "• Created and managed MySQL databases"
        "Incomplete in Mathematics and Physics",
           "Josip Juraj Strossmayer University of Osijek, 09/1998 - 10/2002",
             "This university study programme leads to the acquisition of competences necessary for mathematics and physics teachers.",
             "I quit after the second year because I realized teaching wasn't for me."
      ],
      "certifications": [
        "AWS Certified DevOps Engineer – Professional",
        "AWS Certified Solutions Architect – Professional",
        "KCNA: Kubernetes and Cloud Native Associate",
        "AZ-305 Designing Microsoft Azure Infrastructure Solutions",
        "Certified SAFe® 6 Scrum Master",
        "ISTQB® Certified Tester Foundation Level (v4.0)"
    ],

      "contact": [
        "LinkedIn: https://www.linkedin.com/in/djurdjica-sesar/",
        "GitHub: "
      ]
    },
    "prompt": "root > "
  };


  const terminalConfigurations = {
    terminal: terminalSettings,
    cv: cvInteraction,
    addons: addonsConfig,
    container: document.querySelector("#terminal"),
  };

  new CVTerminal(terminalConfigurations);
}
